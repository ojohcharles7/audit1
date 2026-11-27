"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { notifyUserIdsForOutlet, notifyUsers } from "@/lib/notifications";
import { canAccessOutlet, getScope } from "@/lib/scope";

async function loadAction(id: string) {
  return await get<{
    id: string;
    ref: string;
    finding_id: string;
    outlet_id: string;
    officer_id: string;
    status: string;
    finding_ref: string;
  }>(
    `SELECT ca.id, ca.ref, ca.finding_id, f.outlet_id, ca.officer_id, ca.status, f.ref finding_ref
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id WHERE ca.id=?`,
    [id],
  );
}

export async function updateActionAction(formData: FormData) {
  const user = await requirePermission("actions.manage");
  const scope = await getScope(user);
  const id = String(formData.get("actionId") ?? "");
  const action = await loadAction(id);
  if (!action || !(await canAccessOutlet(scope, action.outlet_id))) redirect("/actions?error=Access+denied");
  const progress = Math.max(0, Math.min(100, Number(formData.get("progress") ?? 0)));
  const comments = String(formData.get("comments") ?? "").trim();
  const status = progress >= 100 ? "awaiting_verification" : progress > 0 ? "in_progress" : "not_started";
  await run("UPDATE corrective_actions SET progress=?, status=?, management_comments=?, updated_at=? WHERE id=?", [progress, status, comments || null, nowIso(), id]);
  if (progress >= 100) {
    await run("UPDATE findings SET status='awaiting_verification', updated_at=? WHERE id=? AND status NOT IN ('resolved','rejected')", [nowIso(), action.finding_id]);
  } else {
    await run("UPDATE findings SET status='action_in_progress', updated_at=? WHERE id=? AND status IN ('open','management_response_pending')", [nowIso(), action.finding_id]);
  }
  await logActivity({
    actorId: user.id,
    action: "action.updated",
    entityType: "corrective_action",
    entityId: id,
    summary: `Updated ${action.ref} to ${progress}%`,
    metadata: { progress, status },
  });
  if (progress >= 100) {
    const recipients = [...new Set(await notifyUserIdsForOutlet(action.outlet_id))].filter((userId) => userId !== user.id);
    await notifyUsers(recipients, {
      type: "action",
      severity: "info",
      title: `Action ready for verification — ${action.ref}`,
      body: `${action.finding_ref}: the action owner reports 100% completion and is awaiting independent verification.`,
      link: `/actions/${id}`,
    });
  }
  revalidatePath(`/actions/${id}`);
  revalidatePath("/actions");
  revalidatePath(`/findings/${action.finding_id}`);
  redirect(`/actions/${id}?updated=1`);
}

export async function verifyActionAction(formData: FormData) {
  const user = await requirePermission("actions.verify");
  const scope = await getScope(user);
  const id = String(formData.get("actionId") ?? "");
  const action = await loadAction(id);
  if (!action || !(await canAccessOutlet(scope, action.outlet_id))) redirect("/actions?error=Access+denied");
  const note = String(formData.get("note") ?? "").trim();
  const current = await get<{ progress: number }>("SELECT progress FROM corrective_actions WHERE id=?", [id]);
  if ((current?.progress ?? 0) < 100) redirect(`/actions/${id}?error=Progress+must+be+100%25+before+verification`);
  await run("UPDATE corrective_actions SET status='verified', verified_by=?, verified_at=?, verification_note=?, updated_at=? WHERE id=?", [user.id, nowIso(), note || "Evidence reviewed and verified.", nowIso(), id]);
  await run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), action.finding_id, "action_verified", action.status, "verified", `${action.ref} independently verified. ${note}`, user.id, nowIso()],
  );
  await logActivity({
    actorId: user.id,
    action: "action.verified",
    entityType: "corrective_action",
    entityId: id,
    summary: `Verified corrective action ${action.ref}`,
  });
  const remaining = await get<{ c: number }>("SELECT count(*) c FROM corrective_actions WHERE finding_id=? AND status NOT IN ('verified','closed')", [action.finding_id]);
  if ((remaining?.c ?? 0) === 0) {
    const head = await get<{ id: string }>("SELECT id FROM users WHERE role='head_audit' AND deleted_at IS NULL LIMIT 1");
    if (head) {
      await notifyUsers([head.id], {
        type: "finding",
        severity: "success",
        title: `Finding ready for verification — ${action.finding_ref}`,
        body: "All corrective actions have been independently verified. The finding can now be verified and closed.",
        link: `/findings/${action.finding_id}`,
      });
    }
  }
  revalidatePath(`/actions/${id}`);
  revalidatePath(`/findings/${action.finding_id}`);
  redirect(`/actions/${id}?verified=1`);
}

export async function closeActionAction(formData: FormData) {
  const user = await requirePermission("actions.close");
  const id = String(formData.get("actionId") ?? "");
  const action = await loadAction(id);
  if (!action) redirect("/actions?error=Action+not+found");
  await run("UPDATE corrective_actions SET status='closed', closed_by=?, closed_at=?, updated_at=? WHERE id=?", [user.id, nowIso(), nowIso(), id]);
  await logActivity({
    actorId: user.id,
    action: "action.closed",
    entityType: "corrective_action",
    entityId: id,
    summary: `Closed corrective action ${action.ref}`,
  });
  revalidatePath(`/actions/${id}`);
  redirect(`/actions/${id}?closed=1`);
}
