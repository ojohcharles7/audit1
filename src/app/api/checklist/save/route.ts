import { NextResponse } from "next/server";
import { z } from "zod";
import { all, get, newId, nowIso, run, transaction } from "@/db";
import { assertOrigin, getSessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { canConductAudit, canAccessAudit, getScope } from "@/lib/scope";
import { calculateAuditScore, completeness } from "@/lib/scoring";
import type { QuestionRow, ResponseRow } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  auditId: z.string().min(1),
  questionId: z.string().min(1),
  result: z.string().nullable().optional(),
  numericValue: z.number().nullable().optional(),
  textValue: z.string().nullable().optional(),
  amountKobo: z.number().int().nullable().optional(),
  comment: z.string().nullable().optional(),
  documentIds: z.array(z.string()).optional(),
});

async function scoreAudit(auditId: string, templateId: string) {
  const questions = all<QuestionRow>(
    "SELECT * FROM checklist_questions WHERE template_id=? AND active=1 ORDER BY sort_order",
    [templateId],
  );
  const responses = all<ResponseRow>(
    `SELECT r.*, (SELECT count(*) FROM audit_response_documents rd WHERE rd.response_id=r.id) document_count
     FROM audit_responses r WHERE r.audit_id=?`,
    [auditId],
  );
  const breakdown = calculateAuditScore(questions, responses);
  const rating = breakdown.score >= 85 ? "low" : breakdown.score >= 70 ? "medium" : breakdown.score >= 55 ? "high" : "critical";
  run("UPDATE audits SET score=?, compliance_rate=?, risk_rating=? WHERE id=?", [
    breakdown.score,
    breakdown.complianceRate,
    rating,
    auditId,
  ]);
  return { breakdown, completeness: completeness(questions, responses) };
}

export async function POST(request: Request) {
  if (!(await assertOrigin(request))) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid response" }, { status: 400 });
  const data = parsed.data;
  const audit = get<{
    id: string;
    template_id: string;
    auditor_id: string;
    manager_id: string | null;
    created_by: string | null;
    outlet_id: string;
    status: string;
    locked_at: string | null;
    ref: string;
  }>("SELECT id, template_id, auditor_id, manager_id, created_by, outlet_id, status, locked_at, ref FROM audits WHERE id=?", [data.auditId]);
  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  if (!canAccessAudit(getScope(user), audit.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canConductAudit(user, audit)) return NextResponse.json({ error: "You are not assigned to conduct this audit" }, { status: 403 });
  if (audit.locked_at) return NextResponse.json({ error: "This audit has been submitted and locked" }, { status: 409 });
  const question = get<QuestionRow>("SELECT * FROM checklist_questions WHERE id=? AND template_id=?", [data.questionId, audit.template_id]);
  if (!question) return NextResponse.json({ error: "Question does not belong to this audit" }, { status: 400 });

  const result = transaction((db) => {
    const existing = db
      .prepare("SELECT id FROM audit_responses WHERE audit_id=? AND question_id=?")
      .get(audit.id, question.id) as { id: string } | undefined;
    const responseId = existing?.id ?? newId();
    const now = nowIso();
    if (existing) {
      db.prepare(
        "UPDATE audit_responses SET result=?, score_awarded=?, numeric_value=?, text_value=?, amount_kobo=?, comment=?, answered_by=?, answered_at=COALESCE(answered_at, ?), updated_at=? WHERE id=?",
      ).run(
        data.result ?? null,
        null,
        data.numericValue ?? null,
        data.textValue ?? null,
        data.amountKobo ?? null,
        data.comment ?? null,
        user.id,
        now,
        now,
        responseId,
      );
    } else {
      db.prepare(
        "INSERT INTO audit_responses (id, audit_id, question_id, result, numeric_value, text_value, amount_kobo, comment, answered_by, answered_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        responseId,
        audit.id,
        question.id,
        data.result ?? null,
        data.numericValue ?? null,
        data.textValue ?? null,
        data.amountKobo ?? null,
        data.comment ?? null,
        user.id,
        now,
        now,
      );
    }

    if (data.documentIds) {
      const valid = data.documentIds.length
        ? (db
            .prepare(
              `SELECT id FROM documents WHERE deleted_at IS NULL AND (audit_id=? OR uploaded_by=?) AND id IN (${data.documentIds.map(() => "?").join(",")})`,
            )
            .all(audit.id, user.id, ...data.documentIds) as { id: string }[])
        : [];
      db.prepare("DELETE FROM audit_response_documents WHERE response_id=?").run(responseId);
      for (const doc of valid) {
        db.prepare("INSERT OR IGNORE INTO audit_response_documents (response_id, document_id) VALUES (?,?)").run(responseId, doc.id);
      }
    }

    if (audit.status === "scheduled") {
      db.prepare("UPDATE audits SET status='in_progress', started_at=COALESCE(started_at, ?) WHERE id=?").run(now, audit.id);
    }
    return responseId;
  });

  const scored = await scoreAudit(audit.id, audit.template_id);
  if (audit.status === "scheduled") {
    logActivity({
      actorId: user.id,
      action: "audit.started",
      entityType: "audit",
      entityId: audit.id,
      summary: `Started audit ${audit.ref}`,
    });
  }

  return NextResponse.json({
    ok: true,
    responseId: result,
    score: scored.breakdown.score,
    complianceRate: scored.breakdown.complianceRate,
    completeness: scored.completeness,
  });
}
