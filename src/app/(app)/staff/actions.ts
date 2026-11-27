"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity";
import { initialsOf } from "@/lib/format";

export async function createStaffAction(formData: FormData) {
  const actor = await requirePermission("staff.manage");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !role || password.length < 8) redirect("/staff?error=Complete+all+fields+with+a+password+of+at+least+8+characters");
  if (await get("SELECT id FROM users WHERE lower(email)=?", [email])) redirect("/staff?error=An+account+already+exists+for+that+email");
  const { salt, hash } = hashPassword(password);
  const id = newId();
  await run("INSERT INTO users (id, name, email, password_salt, password_hash, role, title, initials, outlet_id, region_id, status, mfa_enabled, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [
    id, name, email, salt, hash, role, String(formData.get("title") ?? role.replace("_", " ")), initialsOf(name), String(formData.get("outletId") ?? "") || null, String(formData.get("regionId") ?? "") || null, "active", 0, nowIso(),
  ]);
  await logActivity({ actorId: actor.id, action: "user.created", entityType: "user", entityId: id, summary: `Created ${role} account for ${name}` });
  revalidatePath("/staff");
  redirect("/staff?created=1");
}

export async function updateStaffAction(formData: FormData) {
  const actor = await requirePermission("staff.manage");
  const id = String(formData.get("userId") ?? "");
  const user = await get<{ name: string }>("SELECT name FROM users WHERE id=?", [id]);
  if (!user) redirect("/staff?error=User+not+found");
  await run("UPDATE users SET role=?, title=?, outlet_id=?, region_id=?, status=? WHERE id=?", [
    String(formData.get("role") ?? "auditor"),
    String(formData.get("title") ?? ""),
    String(formData.get("outletId") ?? "") || null,
    String(formData.get("regionId") ?? "") || null,
    String(formData.get("status") ?? "active"),
    id,
  ]);
  await logActivity({ actorId: actor.id, action: "user.updated", entityType: "user", entityId: id, summary: `Updated account ${user.name}` });
  revalidatePath(`/staff/${id}`);
  revalidatePath("/staff");
  redirect(`/staff/${id}?updated=1`);
}

export async function resetPasswordAction(formData: FormData) {
  const actor = await requirePermission("staff.manage");
  const id = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/staff/${id}?error=Password+must+be+at+least+8+characters`);
  const { salt, hash } = hashPassword(password);
  await run("UPDATE users SET password_salt=?, password_hash=? WHERE id=?", [salt, hash, id]);
  await run("UPDATE sessions SET revoked_at=? WHERE user_id=?", [nowIso(), id]);
  await logActivity({ actorId: actor.id, action: "user.password_reset", entityType: "user", entityId: id, summary: "Reset user password and revoked sessions" });
  redirect(`/staff/${id}?password=1`);
}
