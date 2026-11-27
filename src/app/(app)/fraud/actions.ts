"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nextYearRef, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { appendFraudUpdate, logActivity } from "@/lib/activity";
import { notifyUsers } from "@/lib/notifications";
import { canViewFraudCase } from "@/lib/scope";

export async function createFraudCaseAction(formData: FormData) {
  const user = await requirePermission("fraud.manage");
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const officerId = String(formData.get("officerId") ?? "");
  const outletId = String(formData.get("outletId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  if (!title || !type || !officerId || !description) redirect("/fraud?error=Complete+the+case+registration+form");
  const id = newId();
  const ref = nextYearRef("fraud", "FRD");
  const openedAt = nowIso();
  run(
    "INSERT INTO fraud_cases (id, ref, title, type, description, officer_id, outlet_id, suspected_exposure_kobo, incident_date, location, witnesses, status, opened_at, created_by, created_at, restricted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, ref, title, type, description, officerId, outletId, Math.round(Number(formData.get("exposure") ?? 0) * 100), String(formData.get("incidentDate") ?? new Date().toISOString().slice(0, 10)), String(formData.get("location") ?? "") || null, String(formData.get("witnesses") ?? "") || null, "registered", openedAt, user.id, openedAt, 1],
  );
  run("INSERT INTO case_access (case_id, user_id, granted_by, granted_at) VALUES (?,?,?,?)", [id, officerId, user.id, openedAt]);
  appendFraudUpdate({ caseId: id, kind: "note", content: "Confidential case registered by Internal Audit. Access is restricted to authorised officers.", authorId: user.id, occurredAt: openedAt });
  notifyUsers([officerId], { type: "fraud", severity: "critical", title: `Investigation assigned — ${ref}`, body: "You have been assigned as investigation officer on a confidential case.", link: `/fraud/${id}` });
  logActivity({ actorId: user.id, action: "fraud.case.created", entityType: "fraud_case", entityId: id, summary: `Registered confidential fraud case ${ref}`, metadata: { type, officerId } });
  revalidatePath("/fraud");
  redirect(`/fraud/${id}?created=1`);
}

export async function addFraudUpdateAction(formData: FormData) {
  const user = await requirePermission("fraud.investigate");
  const caseId = String(formData.get("caseId") ?? "");
  if (!canViewFraudCase(user, caseId)) redirect("/fraud?error=Access+denied");
  const content = String(formData.get("content") ?? "").trim();
  const kind = String(formData.get("kind") ?? "note");
  if (content.length < 3) redirect(`/fraud/${caseId}?error=Enter+the+update+details`);
  appendFraudUpdate({ caseId, kind, content, authorId: user.id, occurredAt: nowIso() });
  run("UPDATE fraud_cases SET status = CASE WHEN status='registered' THEN 'investigating' ELSE status END WHERE id=?", [caseId]);
  logActivity({ actorId: user.id, action: "fraud.update.added", entityType: "fraud_case", entityId: caseId, summary: `Added ${kind} to confidential case` });
  revalidatePath(`/fraud/${caseId}`);
  redirect(`/fraud/${caseId}?updated=1`);
}

export async function grantCaseAccessAction(formData: FormData) {
  const user = await requirePermission("fraud.manage");
  const caseId = String(formData.get("caseId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const target = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE lower(email)=? AND deleted_at IS NULL", [email]);
  if (!target) redirect(`/fraud/${caseId}?error=No+active+user+found+for+that+email`);
  run("INSERT OR IGNORE INTO case_access (case_id, user_id, granted_by, granted_at) VALUES (?,?,?,?)", [caseId, target.id, user.id, nowIso()]);
  logActivity({ actorId: user.id, action: "fraud.access.granted", entityType: "fraud_case", entityId: caseId, summary: `Granted case access to ${target.name}`, metadata: { targetId: target.id } });
  notifyUsers([target.id], { type: "fraud", severity: "critical", title: "Confidential case access granted", body: "You have been granted access to a restricted investigation case.", link: `/fraud/${caseId}` });
  revalidatePath(`/fraud/${caseId}`);
  redirect(`/fraud/${caseId}?access=1`);
}

export async function closeFraudCaseAction(formData: FormData) {
  const user = await requirePermission("fraud.manage");
  const caseId = String(formData.get("caseId") ?? "");
  if (user.role !== "head_audit") redirect(`/fraud/${caseId}?error=Only+the+Head+of+Audit+can+approve+case+closure`);
  const conclusion = String(formData.get("conclusion") ?? "").trim();
  if (conclusion.length < 10) redirect(`/fraud/${caseId}?error=Provide+a+closure+conclusion`);
  const fraud = get<{ ref: string; officer_id: string; outlet_id: string | null }>("SELECT ref, officer_id, outlet_id FROM fraud_cases WHERE id=?", [caseId]);
  if (!fraud) redirect("/fraud?error=Case+not+found");
  run("UPDATE fraud_cases SET status='closed', conclusion=?, closed_at=?, closure_approved_by=?, closure_approved_at=? WHERE id=?", [conclusion, nowIso(), user.id, nowIso(), caseId]);
  appendFraudUpdate({ caseId, kind: "closure", content: conclusion, authorId: user.id, occurredAt: nowIso() });
  logActivity({ actorId: user.id, action: "fraud.case.closed", entityType: "fraud_case", entityId: caseId, summary: `Approved closure of ${fraud.ref}` });
  revalidatePath(`/fraud/${caseId}`);
  revalidatePath("/fraud");
  redirect(`/fraud/${caseId}?closed=1`);
}
