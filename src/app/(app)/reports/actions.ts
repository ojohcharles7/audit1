"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { createReportRecord, type ReportKind, REPORT_KINDS } from "@/lib/reports";
import { getScope } from "@/lib/scope";

export async function generateReportAction(formData: FormData) {
  const user = await requirePermission("reports.generate");
  const scope = await getScope(user);
  const kind = String(formData.get("kind") ?? "") as ReportKind;
  const auditId = String(formData.get("auditId") ?? "") || null;
  const from = String(formData.get("from") ?? "") || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = String(formData.get("to") ?? "") || new Date().toISOString().slice(0, 10);
  if (!REPORT_KINDS.some((item) => item.id === kind)) redirect("/reports?error=Select+a+valid+report+type");
  if (kind === "audit" && !auditId) redirect("/reports?error=Select+an+audit+for+the+audit+report");
  const report = await createReportRecord({ user, scope, kind, auditId, from, to });
  if (!report) redirect("/reports?error=Report+could+not+be+generated");
  revalidatePath("/reports");
  redirect(`/reports/${report.id}?generated=1`);
}

export async function approveReportAction(formData: FormData) {
  const user = await requirePermission("reports.approve");
  const id = String(formData.get("reportId") ?? "");
  const report = await get<{ report_ref: string; status: string }>("SELECT report_ref, status FROM audit_reports WHERE id=?", [id]);
  if (!report) redirect("/reports?error=Report+not+found");
  await run("UPDATE audit_reports SET status='approved', approved_by=?, approved_at=? WHERE id=?", [user.id, nowIso(), id]);
  await logActivity({ actorId: user.id, action: "report.approved", entityType: "audit_report", entityId: id, summary: `Approved report ${report.report_ref}` });
  revalidatePath(`/reports/${id}`);
  revalidatePath("/reports");
  redirect(`/reports/${id}?approved=1`);
}
