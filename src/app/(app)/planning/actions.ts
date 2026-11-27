"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { get, newId, nextYearRef, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { notifyOutletManagers, notifyUserIdsForOutlet, notifyUsers } from "@/lib/notifications";
import { canAccessOutlet, getScope } from "@/lib/scope";
import { categoryLabel } from "@/lib/constants";

const auditSchema = z.object({
  outletId: z.string().min(1),
  templateId: z.string().min(1),
  auditorId: z.string().min(1),
  auditType: z.string().min(1),
  plannedDate: z.string().min(1),
  dueDate: z.string().min(1),
  objectives: z.string().optional(),
  scope: z.string().optional(),
  methodology: z.string().optional(),
  repeat: z.enum(["none", "monthly", "quarterly"]).optional(),
  occurrences: z.coerce.number().min(1).max(12).optional(),
});

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function createAuditAction(formData: FormData) {
  const user = await requirePermission("planning.manage");
  const scope = await getScope(user);
  const parsed = auditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/planning?error=Complete+all+required+audit+fields");
  const data = parsed.data;
  if (!(await canAccessOutlet(scope, data.outletId))) redirect("/planning?error=You+do+not+have+access+to+that+outlet");
  const outlet = await get<{ name: string; manager_id: string | null }>("SELECT name, manager_id FROM outlets WHERE id = ?", [data.outletId]);
  const template = await get<{ name: string; category: string }>("SELECT name, category FROM audit_templates WHERE id = ?", [data.templateId]);
  const auditor = await get<{ name: string }>("SELECT name FROM users WHERE id = ? AND role = 'auditor'", [data.auditorId]);
  if (!outlet || !template || !auditor) redirect("/planning?error=Invalid+outlet,+template+or+auditor");

  const repeat = data.repeat ?? "none";
  const occurrences = repeat === "none" ? 1 : Math.min(12, data.occurrences ?? 3);
  const group = repeat === "none" ? null : newId();
  const planned = new Date(`${data.plannedDate}T09:00:00`);
  const ids: string[] = [];

  for (let i = 0; i < occurrences; i++) {
    const date = repeat === "quarterly" ? addMonths(planned, i * 3) : addMonths(planned, i);
    const plannedDate = date.toISOString().slice(0, 10);
    const due = new Date(date.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const id = newId();
    ids.push(id);
    const ref = await nextYearRef("audit", "AUD");
    await run(
      `INSERT INTO audits (id, ref, outlet_id, template_id, audit_type, category, title, auditor_id, manager_id, planned_date, due_date, status, objectives, scope, methodology, created_by, created_at, recurrence_group)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        ref,
        data.outletId,
        data.templateId,
        data.auditType,
        template.category,
        `${template.name.replace(" Audit", "")} — ${outlet.name}`,
        data.auditorId,
        user.role === "head_audit" || user.role === "audit_manager" ? user.id : null,
        plannedDate,
        due,
        "scheduled",
        data.objectives || null,
        data.scope || null,
        data.methodology || "Inspection, transaction testing, observation and evidence review.",
        user.id,
        nowIso(),
        group,
      ],
    );
    await logActivity({
      actorId: user.id,
      action: "audit.created",
      entityType: "audit",
      entityId: id,
      summary: `Scheduled ${categoryLabel(template.category)} audit ${ref} at ${outlet.name}`,
      metadata: { ref, plannedDate, repeat },
    });
    await notifyUsers([data.auditorId], {
      type: "audit",
      severity: "info",
      title: `Audit assigned — ${ref}`,
      body: `${template.name} at ${outlet.name} is scheduled for ${plannedDate}.`,
      link: `/audits/${id}`,
    });
    await notifyOutletManagers(data.outletId, {
      type: "audit",
      severity: "info",
      title: `Audit scheduled — ${ref}`,
      body: `An audit is scheduled at your outlet for ${plannedDate}.`,
      link: `/audits/${id}`,
    });
  }

  const regional = await notifyUserIdsForOutlet(data.outletId);
  await notifyUsers(
    regional.filter((id) => id !== data.auditorId),
    {
      type: "audit",
      severity: "info",
      title: `Audit plan updated — ${outlet.name}`,
      body: `${occurrences} audit${occurrences === 1 ? "" : "s"} scheduled with ${auditor.name}.`,
      link: "/planning",
    },
  );

  revalidatePath("/planning");
  revalidatePath("/audits");
  revalidatePath("/dashboard");
  redirect("/audits?created=1");
}

export async function createRecurringScheduleAction(formData: FormData) {
  const user = await requirePermission("planning.manage");
  const scope = await getScope(user);
  const outletId = String(formData.get("outletId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const auditorId = String(formData.get("auditorId") ?? "");
  const frequency = String(formData.get("frequency") ?? "monthly");
  const nextDate = String(formData.get("nextDate") ?? "");
  if (!outletId || !templateId || !auditorId || !nextDate) redirect("/planning?error=Complete+the+schedule+form");
  if (!(await canAccessOutlet(scope, outletId))) redirect("/planning?error=Access+denied");
  await run(
    "INSERT INTO audit_schedules (id, outlet_id, template_id, auditor_id, frequency, next_date, occurrences, active, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [newId(), outletId, templateId, auditorId, frequency, nextDate, Number(formData.get("occurrences") ?? 12), 1, user.id, nowIso()],
  );
  await logActivity({
    actorId: user.id,
    action: "audit.schedule.created",
    entityType: "audit_schedule",
    summary: `Created ${frequency} recurring audit schedule`,
  });
  revalidatePath("/planning");
  redirect("/planning?scheduled=1");
}

export async function cancelAuditAction(formData: FormData) {
  const user = await requirePermission("planning.manage");
  const id = String(formData.get("auditId") ?? "");
  const audit = await get<{ ref: string; status: string }>("SELECT ref, status FROM audits WHERE id = ?", [id]);
  if (!audit || !["scheduled", "overdue"].includes(audit.status)) redirect("/planning?error=Audit+cannot+be+cancelled");
  await run("UPDATE audits SET status = 'cancelled' WHERE id = ?", [id]);
  await logActivity({
    actorId: user.id,
    action: "audit.cancelled",
    entityType: "audit",
    entityId: id,
    summary: `Cancelled audit ${audit.ref}`,
  });
  revalidatePath("/planning");
  revalidatePath("/audits");
  redirect("/planning?cancelled=1");
}
