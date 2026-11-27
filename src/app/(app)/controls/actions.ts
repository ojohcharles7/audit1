"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { notifyUsers } from "@/lib/notifications";

export async function createControlAction(formData: FormData) {
  const user = await requirePermission("controls.manage");
  const name = String(formData.get("name") ?? "").trim();
  const department = String(formData.get("department") ?? "");
  if (!name || !department) redirect("/controls?error=Name+and+department+are+required");
  const count = (await get<{ c: number }>("SELECT count(*) c FROM controls"))?.c ?? 0;
  const id = newId();
  await run("INSERT INTO controls (id, control_ref, name, description, objective, owner_id, department, frequency, test_procedure, evidence_required, effectiveness, next_test_at, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
    id, `CTL-${String(count + 1).padStart(3, "0")}`, name, String(formData.get("description") ?? ""), String(formData.get("objective") ?? "") || null, String(formData.get("ownerId") ?? "") || null, department, String(formData.get("frequency") ?? "Monthly"), String(formData.get("testProcedure") ?? "") || null, String(formData.get("evidence") ?? "") || null, "not_tested", String(formData.get("nextTest") ?? "") || null, "active", nowIso(), nowIso(),
  ]);
  await logActivity({ actorId: user.id, action: "control.created", entityType: "control", entityId: id, summary: `Created internal control: ${name}` });
  revalidatePath("/controls");
  redirect(`/controls/${id}`);
}

export async function recordControlTestAction(formData: FormData) {
  const user = await requirePermission("controls.test");
  const controlId = String(formData.get("controlId") ?? "");
  const control = await get<{ control_ref: string; name: string; owner_id: string | null }>("SELECT control_ref, name, owner_id FROM controls WHERE id=?", [controlId]);
  if (!control) redirect("/controls?error=Control+not+found");
  const result = String(formData.get("result") ?? "effective");
  const testedAt = String(formData.get("testedAt") ?? nowIso().slice(0, 10));
  await run("INSERT INTO control_tests (id, control_id, audit_id, tester_id, tested_at, result, sample_size, exceptions, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    newId(), controlId, String(formData.get("auditId") ?? "") || null, user.id, `${testedAt}T12:00:00.000Z`, result, Number(formData.get("sampleSize") ?? 0) || null, Number(formData.get("exceptions") ?? 0) || 0, String(formData.get("notes") ?? "") || null, nowIso(),
  ]);
  await run("UPDATE controls SET effectiveness=?, last_tested_at=?, next_test_at=?, updated_at=? WHERE id=?", [result, `${testedAt}T12:00:00.000Z`, new Date(new Date(testedAt).getTime() + 90 * 86400000).toISOString().slice(0, 10), nowIso(), controlId]);
  await logActivity({ actorId: user.id, action: "control.tested", entityType: "control", entityId: controlId, summary: `Tested ${control.control_ref}: ${result}`, metadata: { result } });
  if (result === "ineffective" && control.owner_id) {
    await notifyUsers([control.owner_id], { type: "control", severity: "critical", title: `Control ineffective — ${control.control_ref}`, body: `${control.name} tested ineffective. Remediation is required.`, link: `/controls/${controlId}` });
  }
  revalidatePath(`/controls/${controlId}`);
  redirect(`/controls/${controlId}?tested=1`);
}
