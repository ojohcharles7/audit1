"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { get, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { createReportRecord } from "@/lib/reports";
import { raiseFinding } from "@/lib/mutations";
import { notifyUserIdsForOutlet, notifyUsers } from "@/lib/notifications";
import { canAccessAudit, getScope } from "@/lib/scope";

export async function approveAuditAction(formData: FormData) {
  const user = await requirePermission("audits.approve");
  const scope = await getScope(user);
  const id = String(formData.get("auditId") ?? "");
  const audit = await get<{ ref: string; status: string; auditor_id: string; outlet_id: string }>(
    "SELECT ref, status, auditor_id, outlet_id FROM audits WHERE id = ?",
    [id],
  );
  if (!audit || !(await canAccessAudit(scope, id))) redirect("/audits?error=Audit+not+found");
  if (!["submitted", "under_review"].includes(audit.status)) redirect(`/audits/${id}?error=Only+submitted+audits+can+be+approved`);

  const report = await createReportRecord({
    user,
    scope,
    kind: "audit",
    auditId: id,
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  await run("UPDATE audits SET status='approved', approved_by=?, approved_at=? WHERE id=?", [user.id, nowIso(), id]);
  await logActivity({
    actorId: user.id,
    action: "audit.approved",
    entityType: "audit",
    entityId: id,
    summary: `Approved audit ${audit.ref}`,
  });
  const recipients = [audit.auditor_id, ...(await notifyUserIdsForOutlet(audit.outlet_id))];
  await notifyUsers([...new Set(recipients)], {
    type: "audit",
    severity: "success",
    title: `Audit approved — ${audit.ref}`,
    body: `The audit report has been approved and is available in the reporting centre.`,
    link: report ? `/reports/${report.id}` : `/audits/${id}`,
  });
  revalidatePath(`/audits/${id}`);
  revalidatePath("/audits");
  revalidatePath("/reports");
  redirect(`/audits/${id}?approved=1`);
}

export async function generateAuditReportAction(formData: FormData) {
  const user = await requirePermission("reports.generate");
  const scope = await getScope(user);
  const auditId = String(formData.get("auditId") ?? "");
  if (!(await canAccessAudit(scope, auditId))) redirect("/audits?error=Access+denied");
  const report = await createReportRecord({
    user,
    scope,
    kind: "audit",
    auditId,
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  if (!report) redirect(`/audits/${auditId}?error=Report+could+not+be+generated`);
  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

const findingSchema = z.object({
  auditId: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(4),
  description: z.string().min(10),
  expectedControl: z.string().optional(),
  actualObservation: z.string().optional(),
  rootCause: z.string().optional(),
  recommendation: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low", "observation"]),
  financialImpact: z.coerce.number().min(0).default(0),
  targetDate: z.string().min(1),
});

export async function addAuditFindingAction(formData: FormData) {
  const user = await requirePermission("findings.create");
  const scope = await getScope(user);
  const parsed = findingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const auditId = String(formData.get("auditId") ?? "");
    redirect(`/audits/${auditId}?error=Complete+all+finding+fields`);
  }
  const data = parsed.data;
  if (!(await canAccessAudit(scope, data.auditId))) redirect("/audits?error=Access+denied");
  const audit = await get<{ outlet_id: string; ref: string }>("SELECT outlet_id, ref FROM audits WHERE id=?", [data.auditId]);
  if (!audit) redirect("/audits?error=Audit+not+found");
  const manager = await get<{ id: string }>(
    "SELECT id FROM users WHERE outlet_id=? AND role='outlet_manager' AND deleted_at IS NULL LIMIT 1",
    [audit.outlet_id],
  );
  const finding = await raiseFinding({
    actorId: user.id,
    outletId: audit.outlet_id,
    auditId: data.auditId,
    category: data.category,
    title: data.title,
    description: data.description,
    expectedControl: data.expectedControl,
    actualObservation: data.actualObservation,
    rootCause: data.rootCause,
    recommendation: data.recommendation,
    severity: data.severity,
    financialImpactKobo: Math.round(data.financialImpact * 100),
    responsibleUserId: manager?.id ?? null,
    targetDate: data.targetDate,
  });
  revalidatePath(`/audits/${data.auditId}`);
  revalidatePath("/findings");
  revalidatePath("/dashboard");
  redirect(`/findings/${finding.id}?created=1`);
}

export async function updateAuditWorkflowAction(formData: FormData) {
  const user = await requirePermission("audits.conduct");
  const scope = await getScope(user);
  const auditId = String(formData.get("auditId") ?? "");
  const nextStatus = String(formData.get("status") ?? "");
  if (!["under_review", "closed", "approved"].includes(nextStatus)) redirect(`/audits/${auditId}?error=Invalid+status`);
  if (!(await canAccessAudit(scope, auditId))) redirect("/audits?error=Access+denied");
  if (nextStatus === "approved" && user.role !== "head_audit") redirect(`/audits/${auditId}?error=Only+the+Head+of+Audit+can+approve`);
  await run("UPDATE audits SET status=? WHERE id=?", [nextStatus, auditId]);
  await logActivity({
    actorId: user.id,
    action: `audit.${nextStatus}`,
    entityType: "audit",
    entityId: auditId,
    summary: `Audit status changed to ${nextStatus}`,
  });
  revalidatePath(`/audits/${auditId}`);
  redirect(`/audits/${auditId}`);
}

export async function notifyAuditManagerAction(formData: FormData) {
  const user = await requirePermission("audits.conduct");
  const auditId = String(formData.get("auditId") ?? "");
  const audit = await get<{ manager_id: string | null; ref: string }>("SELECT manager_id, ref FROM audits WHERE id=?", [auditId]);
  if (audit?.manager_id) {
    await notifyUsers([audit.manager_id], {
      type: "audit",
      severity: "info",
      title: `Review requested — ${audit.ref}`,
      body: `${user.name} requested a review of the audit working papers.`,
      link: `/audits/${auditId}`,
    });
  }
  revalidatePath(`/audits/${auditId}`);
  redirect(`/audits/${auditId}?review=requested`);
}
