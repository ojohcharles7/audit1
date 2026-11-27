"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";

export async function createTemplateAction(formData: FormData) {
  const user = await requirePermission("checklists.manage");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!name || !category) redirect("/checklists?error=Name+and+category+are+required");
  const count = (await get<{ c: number }>("SELECT count(*) c FROM audit_templates"))?.c ?? 0;
  const id = newId();
  await run("INSERT INTO audit_templates (id, code, name, category, version, description, active, created_by, approved_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
    id,
    `TPL-${String(count + 1).padStart(3, "0")}`,
    name,
    category,
    1,
    description || null,
    1,
    user.id,
    user.id,
    nowIso(),
  ]);
  await logActivity({ actorId: user.id, action: "template.created", entityType: "audit_template", entityId: id, summary: `Created audit template ${name}` });
  revalidatePath("/checklists");
  redirect(`/checklists/${id}`);
}

export async function addQuestionAction(formData: FormData) {
  const user = await requirePermission("checklists.manage");
  const templateId = String(formData.get("templateId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!templateId || text.length < 5) redirect(`/checklists/${templateId}?error=Question+text+is+required`);
  const template = await get<{ category: string; code: string }>("SELECT category, code FROM audit_templates WHERE id=?", [templateId]);
  if (!template) redirect("/checklists?error=Template+not+found");
  const section = String(formData.get("section") ?? "General controls").trim() || "General controls";
  const count = (await get<{ c: number }>("SELECT count(*) c FROM checklist_questions WHERE template_id=?", [templateId]))?.c ?? 0;
  const risk = String(formData.get("risk") ?? "medium");
  const weight = Number(formData.get("weight") ?? (risk === "high" || risk === "critical" ? 3 : risk === "medium" ? 2 : 1));
  const evidence = String(formData.get("evidence") ?? "none");
  const responseType = String(formData.get("responseType") ?? "compliance");
  await run(
    "INSERT INTO checklist_questions (id, template_id, section, code, text, category, control_objective, procedure, expected_control, response_type, risk_level, evidence_required, weight, mandatory, sort_order, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      newId(),
      templateId,
      section,
      `${template.code.replace("TPL-", "")}-${String(count + 1).padStart(2, "0")}`,
      text,
      template.category,
      String(formData.get("objective") ?? "") || `Confirm that ${text.toLowerCase()}`,
      String(formData.get("procedure") ?? "") || "Inspect records, sample transactions and observe the control.",
      String(formData.get("expected") ?? "") || text,
      responseType,
      risk,
      evidence,
      weight,
      formData.get("mandatory") ? 1 : 1,
      count + 1,
      1,
    ],
  );
  await logActivity({ actorId: user.id, action: "template.question_added", entityType: "audit_template", entityId: templateId, summary: `Added checklist question: ${text.slice(0, 80)}` });
  revalidatePath(`/checklists/${templateId}`);
  redirect(`/checklists/${templateId}`);
}

export async function toggleTemplateAction(formData: FormData) {
  const user = await requirePermission("checklists.manage");
  const id = String(formData.get("templateId") ?? "");
  const template = await get<{ active: number; name: string }>("SELECT active, name FROM audit_templates WHERE id=?", [id]);
  if (!template) redirect("/checklists?error=Template+not+found");
  await run("UPDATE audit_templates SET active=? WHERE id=?", [template.active ? 0 : 1, id]);
  await logActivity({ actorId: user.id, action: "template.toggled", entityType: "audit_template", entityId: id, summary: `${template.active ? "Deactivated" : "Activated"} ${template.name}` });
  revalidatePath("/checklists");
  redirect("/checklists");
}
