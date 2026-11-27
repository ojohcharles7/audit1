import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get, nowIso, run } from "@/db";
import { assertOrigin, getSessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { canAccessAudit, canConductAudit, getScope } from "@/lib/scope";
import { calculateAuditScore, completeness } from "@/lib/scoring";
import { raiseFinding } from "@/lib/mutations";
import { notifyOutletManagers, notifyUserIdsForOutlet, notifyUsers } from "@/lib/notifications";
import type { AuditRow, QuestionRow, ResponseRow } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({ auditId: z.string().min(1) });

export async function POST(request: Request) {
  if (!(await assertOrigin(request))) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const auditId = parsed.data.auditId;
  const audit = await get<AuditRow & { outlet_name: string }>(
    "SELECT a.*, o.name outlet_name FROM audits a JOIN outlets o ON o.id=a.outlet_id WHERE a.id=?",
    [auditId],
  );
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (!(await canAccessAudit(await getScope(user), auditId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canConductAudit(user, audit)) return NextResponse.json({ error: "You are not assigned to this audit" }, { status: 403 });
  if (audit.locked_at) return NextResponse.json({ error: "Audit already submitted" }, { status: 409 });

  const questions = await all<QuestionRow>(
    "SELECT * FROM checklist_questions WHERE template_id=? AND active=1 ORDER BY sort_order",
    [audit.template_id],
  );
  const responses = await all<ResponseRow>(
    `SELECT r.*, (SELECT count(*) FROM audit_response_documents rd WHERE rd.response_id=r.id) document_count
     FROM audit_responses r WHERE r.audit_id=?`,
    [auditId],
  );
  const completenessResult = completeness(questions, responses);
  const breakdown = calculateAuditScore(questions, responses);
  const requiredIssues = breakdown.issues.filter((issue) => issue.reason === "unanswered" || issue.reason === "evidence");
  if (completenessResult.missingMandatory > 0 || completenessResult.missingEvidence > 0) {
    return NextResponse.json(
      {
        error: `Complete all mandatory questions and required evidence before submitting. ${requiredIssues.length} item(s) outstanding.`,
        missingMandatory: completenessResult.missingMandatory,
        missingEvidence: completenessResult.missingEvidence,
        issues: requiredIssues.slice(0, 12).map((issue) => ({
          question: issue.question.text,
          reason: issue.reason,
        })),
      },
      { status: 400 },
    );
  }

  const submittedAt = nowIso();
  const rating = breakdown.score >= 85 ? "low" : breakdown.score >= 70 ? "medium" : breakdown.score >= 55 ? "high" : "critical";
  const manager = await get<{ id: string }>(
    "SELECT id FROM users WHERE outlet_id=? AND role='outlet_manager' AND deleted_at IS NULL LIMIT 1",
    [audit.outlet_id],
  );
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const existingResponses = new Set(
    (await all<{ source_response_id: string }>("SELECT source_response_id FROM findings WHERE source_response_id IS NOT NULL AND audit_id=?", [auditId])).map(
      (row) => row.source_response_id,
    ),
  );
  let createdFindings = 0;
  for (const response of responses) {
    if (createdFindings >= 5) break;
    if (!["noncompliant", "investigation"].includes(response.result ?? "")) continue;
    const question = questionMap.get(response.question_id);
    if (!question || !["high", "critical"].includes(question.risk_level)) continue;
    if (existingResponses.has(response.id)) continue;
    const financial = ["financial", "inventory", "asset", "procurement"].includes(question.category)
      ? response.amount_kobo ?? 0
      : 0;
    await raiseFinding({
      actorId: user.id,
      outletId: audit.outlet_id,
      auditId: audit.id,
      category: question.category,
      title: question.text.replace(/\.$/, "").slice(0, 120),
      description: `Audit ${audit.ref} identified an exception against the expected control at ${audit.outlet_name}.`,
      expectedControl: question.expected_control,
      actualObservation: response.comment || "Control not operating as designed.",
      rootCause: "Control exception identified during audit testing.",
      recommendation: "Remediate the control, retain evidence and submit for independent verification.",
      severity: question.risk_level,
      financialImpactKobo: financial,
      responsibleUserId: manager?.id ?? audit.auditor_id,
      targetDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      sourceResponseId: response.id,
      department: question.category,
    });
    createdFindings++;
  }

  await run(
    "UPDATE audits SET status='submitted', score=?, compliance_rate=?, risk_rating=?, submitted_at=?, completed_at=?, locked_at=? WHERE id=?",
    [breakdown.score, breakdown.complianceRate, rating, submittedAt, submittedAt, submittedAt, auditId],
  );
  await logActivity({
    actorId: user.id,
    action: "audit.submitted",
    entityType: "audit",
    entityId: auditId,
    summary: `Submitted and locked audit ${audit.ref} with score ${breakdown.score}%`,
    metadata: { score: breakdown.score, findingsCreated: createdFindings },
  });
  const recipients = [...new Set([audit.manager_id, ...(await notifyUserIdsForOutlet(audit.outlet_id))].filter(Boolean) as string[])];
  await notifyUsers(recipients, {
    type: "audit",
    severity: "info",
    title: `Audit submitted — ${audit.ref}`,
    body: `${audit.outlet_name} audit submitted with a score of ${breakdown.score}%. Review the report and approve or request clarification.`,
    link: `/audits/${auditId}`,
  });
  await notifyOutletManagers(audit.outlet_id, {
    type: "audit",
    severity: rating === "critical" ? "critical" : "info",
    title: `Audit outcome — ${audit.ref}`,
    body: `Your outlet audit has been submitted with a score of ${breakdown.score}%. Findings and actions are now visible.`,
    link: `/audits/${auditId}`,
  });

  return NextResponse.json({
    ok: true,
    score: breakdown.score,
    complianceRate: breakdown.complianceRate,
    findingsCreated: createdFindings,
    redirect: `/audits/${auditId}?submitted=1`,
  });
}
