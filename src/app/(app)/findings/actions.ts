"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { get, newId, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { createCorrectiveAction, raiseFinding } from "@/lib/mutations";
import { notifyUserIdsForOutlet, notifyUsers } from "@/lib/notifications";
import { canAccessOutlet, getScope } from "@/lib/scope";

const createSchema = z.object({
  outletId: z.string().min(1),
  auditId: z.string().optional(),
  category: z.string().min(1),
  title: z.string().min(4),
  description: z.string().min(10),
  expectedControl: z.string().optional(),
  actualObservation: z.string().optional(),
  rootCause: z.string().optional(),
  recommendation: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low", "observation"]),
  financialImpact: z.coerce.number().min(0).default(0),
  responsibleUserId: z.string().optional(),
  targetDate: z.string().min(1),
});

export async function createFindingAction(formData: FormData) {
  const user = await requirePermission("findings.create");
  const scope = getScope(user);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/findings?error=Complete+all+required+finding+fields");
  const data = parsed.data;
  if (!canAccessOutlet(scope, data.outletId)) redirect("/findings?error=Access+denied");
  const manager = get<{ id: string }>(
    "SELECT id FROM users WHERE outlet_id=? AND role='outlet_manager' AND deleted_at IS NULL LIMIT 1",
    [data.outletId],
  );
  const finding = raiseFinding({
    actorId: user.id,
    outletId: data.outletId,
    auditId: data.auditId || null,
    category: data.category,
    title: data.title,
    description: data.description,
    expectedControl: data.expectedControl,
    actualObservation: data.actualObservation,
    rootCause: data.rootCause,
    recommendation: data.recommendation,
    severity: data.severity,
    financialImpactKobo: Math.round(data.financialImpact * 100),
    responsibleUserId: data.responsibleUserId || manager?.id || null,
    targetDate: data.targetDate,
    department: data.category,
  });
  revalidatePath("/findings");
  revalidatePath("/dashboard");
  redirect(`/findings/${finding.id}?created=1`);
}

export async function respondToFindingAction(formData: FormData) {
  const user = await requirePermission("findings.respond");
  const scope = getScope(user);
  const findingId = String(formData.get("findingId") ?? "");
  const response = String(formData.get("managementResponse") ?? "").trim();
  const finding = get<{ outlet_id: string; ref: string; status: string; responsible_user_id: string | null; title: string }>(
    "SELECT outlet_id, ref, status, responsible_user_id, title FROM findings WHERE id=?",
    [findingId],
  );
  if (!finding || !canAccessOutlet(scope, finding.outlet_id)) redirect("/findings?error=Access+denied");
  if (["resolved", "rejected"].includes(finding.status)) redirect(`/findings/${findingId}?error=Finding+is+closed`);
  if (response.length < 5) redirect(`/findings/${findingId}?error=Provide+a+management+response`);
  run("UPDATE findings SET management_response=?, status=?, updated_at=? WHERE id=?", [response, "action_in_progress", nowIso(), findingId]);
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), findingId, "management_response", finding.status, "action_in_progress", response, user.id, nowIso()],
  );
  logActivity({
    actorId: user.id,
    action: "finding.response",
    entityType: "finding",
    entityId: findingId,
    summary: `Management response recorded for ${finding.ref}`,
  });
  notifyUsers([...new Set(notifyUserIdsForOutlet(finding.outlet_id))], {
    type: "finding",
    severity: "info",
    title: `Management response — ${finding.ref}`,
    body: `A management response has been recorded for ${finding.title}.`,
    link: `/findings/${findingId}`,
  });
  revalidatePath(`/findings/${findingId}`);
  revalidatePath("/findings");
  redirect(`/findings/${findingId}?responded=1`);
}

export async function verifyFindingAction(formData: FormData) {
  const user = await requirePermission("findings.verify");
  const scope = getScope(user);
  const findingId = String(formData.get("findingId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const finding = get<{ outlet_id: string; ref: string; status: string; verified_at: string | null }>(
    "SELECT outlet_id, ref, status, verified_at FROM findings WHERE id=?",
    [findingId],
  );
  if (!finding || !canAccessOutlet(scope, finding.outlet_id)) redirect("/findings?error=Access+denied");
  if (["resolved", "rejected"].includes(finding.status)) redirect(`/findings/${findingId}?error=Finding+is+closed`);
  const actions = get<{ total: number; verified: number }>(
    `SELECT count(*) total, coalesce(sum(CASE WHEN status IN ('verified','closed') THEN 1 ELSE 0 END),0) verified FROM corrective_actions WHERE finding_id=?`,
    [findingId],
  );
  if (!actions?.total || (actions.verified ?? 0) < (actions.total ?? 0)) {
    redirect(`/findings/${findingId}?error=All+corrective+actions+must+be+completed+and+verified+before+the+finding+can+be+verified`);
  }
  run("UPDATE findings SET verified_by=?, verified_at=?, status='awaiting_verification', updated_at=? WHERE id=?", [user.id, nowIso(), nowIso(), findingId]);
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), findingId, "verified", finding.status, "awaiting_verification", note || "Remediation independently verified by audit.", user.id, nowIso()],
  );
  logActivity({
    actorId: user.id,
    action: "finding.verified",
    entityType: "finding",
    entityId: findingId,
    summary: `Verified remediation for ${finding.ref}`,
  });
  notifyUsers([...new Set(notifyUserIdsForOutlet(finding.outlet_id))], {
    type: "finding",
    severity: "success",
    title: `Remediation verified — ${finding.ref}`,
    body: "The finding is awaiting authorised closure by the Head of Internal Audit.",
    link: `/findings/${findingId}`,
  });
  revalidatePath(`/findings/${findingId}`);
  redirect(`/findings/${findingId}?verified=1`);
}

export async function closeFindingAction(formData: FormData) {
  const user = await requirePermission("findings.close");
  const findingId = String(formData.get("findingId") ?? "");
  const finding = get<{ outlet_id: string; ref: string; status: string; verified_at: string | null }>(
    "SELECT outlet_id, ref, status, verified_at FROM findings WHERE id=?",
    [findingId],
  );
  if (!finding) redirect("/findings?error=Finding+not+found");
  if (!finding.verified_at) redirect(`/findings/${findingId}?error=Independent+verification+is+required+before+closure`);
  run("UPDATE findings SET status='resolved', closed_by=?, closed_at=?, updated_at=? WHERE id=?", [user.id, nowIso(), nowIso(), findingId]);
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), findingId, "closed", finding.status, "resolved", "Closure approved by Head of Internal Audit.", user.id, nowIso()],
  );
  logActivity({
    actorId: user.id,
    action: "finding.closed",
    entityType: "finding",
    entityId: findingId,
    summary: `Closed finding ${finding.ref} after verification`,
  });
  notifyUsers([...new Set(notifyUserIdsForOutlet(finding.outlet_id))], {
    type: "finding",
    severity: "success",
    title: `Finding closed — ${finding.ref}`,
    body: "The finding has been independently verified and closed.",
    link: `/findings/${findingId}`,
  });
  revalidatePath(`/findings/${findingId}`);
  revalidatePath("/findings");
  revalidatePath("/dashboard");
  redirect(`/findings/${findingId}?closed=1`);
}

export async function rejectFindingAction(formData: FormData) {
  const user = await requirePermission("findings.verify");
  const findingId = String(formData.get("findingId") ?? "");
  const justification = String(formData.get("justification") ?? "").trim();
  const finding = get<{ ref: string; status: string }>("SELECT ref, status FROM findings WHERE id=?", [findingId]);
  if (!finding) redirect("/findings?error=Finding+not+found");
  if (justification.length < 10) redirect(`/findings/${findingId}?error=Provide+a+justification+of+at+least+10+characters`);
  run("UPDATE findings SET status='rejected', updated_at=? WHERE id=?", [nowIso(), findingId]);
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), findingId, "rejected", finding.status, "rejected", justification, user.id, nowIso()],
  );
  logActivity({
    actorId: user.id,
    action: "finding.rejected",
    entityType: "finding",
    entityId: findingId,
    summary: `Rejected finding ${finding.ref} with justification`,
  });
  revalidatePath(`/findings/${findingId}`);
  redirect(`/findings/${findingId}?rejected=1`);
}

export async function addCorrectiveActionFromFindingAction(formData: FormData) {
  const user = await requirePermission("actions.manage");
  const findingId = String(formData.get("findingId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const officerId = String(formData.get("officerId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  const department = String(formData.get("department") ?? "");
  if (!findingId || !description || !officerId || !dueDate) redirect(`/findings/${findingId}?error=Complete+the+action+form`);
  createCorrectiveAction({ actorId: user.id, findingId, description, officerId, dueDate, department });
  run("UPDATE findings SET status='action_in_progress', updated_at=? WHERE id=? AND status IN ('open','management_response_pending')", [nowIso(), findingId]);
  revalidatePath(`/findings/${findingId}`);
  revalidatePath("/actions");
  redirect(`/findings/${findingId}?action=1`);
}
