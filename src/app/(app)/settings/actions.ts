"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { get, nowIso, run } from "@/db";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity";
import { processEmailOutbox } from "@/lib/notifications";
import { DEFAULT_SETTINGS, setSetting, getSetting } from "@/lib/settings";
import { seedDatabase } from "@/db/seed-data";
import { getDb } from "@/db";
import { SESSION_COOKIE } from "@/lib/auth/session-token";

async function currentFullUser() {
  const user = await requireUser();
  return get<{ id: string; email: string; password_salt: string; password_hash: string; mfa_secret: string | null; mfa_enabled: number }>(
    "SELECT id, email, password_salt, password_hash, mfa_secret, mfa_enabled FROM users WHERE id=?",
    [user.id],
  );
}

export async function updateProfileSettingsAction(formData: FormData) {
  const user = await requirePermission("settings.manage");
  const org = {
    ...getSetting<typeof DEFAULT_SETTINGS.org>("org"),
    name: String(formData.get("orgName") ?? ""),
    department: String(formData.get("department") ?? ""),
    address: String(formData.get("address") ?? ""),
    fiscalYear: Number(formData.get("fiscalYear") ?? new Date().getFullYear()),
  };
  const scoring = {
    ...getSetting<typeof DEFAULT_SETTINGS.scoring>("scoring"),
    compliant: Number(formData.get("compliant") ?? 100),
    partial: Number(formData.get("partial") ?? 50),
    noncompliant: Number(formData.get("noncompliant") ?? 0),
  };
  const risk = {
    ...getSetting<typeof DEFAULT_SETTINGS.risk>("risk"),
    critical: Number(formData.get("critical") ?? 20),
    high: Number(formData.get("high") ?? 12),
    medium: Number(formData.get("medium") ?? 5),
  };
  setSetting("org", org, user.id);
  setSetting("scoring", scoring, user.id);
  setSetting("risk", risk, user.id);
  logActivity({ actorId: user.id, action: "settings.updated", entityType: "settings", summary: "Updated organisation, scoring and risk settings" });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requirePermission("settings.view");
  const full = await currentFullUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  if (!full || !verifyPassword(current, full.password_salt, full.password_hash)) redirect("/settings?error=Current+password+is+incorrect");
  if (next.length < 8) redirect("/settings?error=New+password+must+be+at+least+8+characters");
  const { salt, hash } = hashPassword(next);
  run("UPDATE users SET password_salt=?, password_hash=? WHERE id=?", [salt, hash, user.id]);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const { decodeSessionToken } = await import("@/lib/auth/session-token");
    const payload = await decodeSessionToken(token);
    if (payload) run("UPDATE sessions SET revoked_at=? WHERE user_id=? AND token_id != ?", [nowIso(), user.id, payload.sid]);
  }
  logActivity({ actorId: user.id, action: "user.password_changed", entityType: "user", entityId: user.id, summary: "Changed own password" });
  redirect("/settings?password=1");
}

export async function beginMfaAction() {
  const user = await requirePermission("settings.view");
  const { generateSecret, generateURI } = await import("otplib");
  const secret = generateSecret();
  run("UPDATE users SET mfa_secret=?, mfa_enabled=0 WHERE id=?", [secret, user.id]);
  const uri = generateURI({ issuer: "Crunchies Audit", label: user.email, secret });
  logActivity({ actorId: user.id, action: "mfa.setup_started", entityType: "user", entityId: user.id, summary: "Started authenticator enrolment" });
  revalidatePath("/settings");
  redirect(`/settings?mfa=pending&uri=${encodeURIComponent(uri)}`);
}

export async function confirmMfaAction(formData: FormData) {
  const user = await requirePermission("settings.view");
  const full = await currentFullUser();
  const code = String(formData.get("code") ?? "");
  if (!full?.mfa_secret) redirect("/settings?error=MFA+setup+not+started");
  const { verify } = await import("otplib");
  const result = await verify({ secret: full.mfa_secret, token: code });
  if (!result.valid) redirect("/settings?error=Invalid+authenticator+code");
  run("UPDATE users SET mfa_enabled=1 WHERE id=?", [user.id]);
  logActivity({ actorId: user.id, action: "mfa.enabled", entityType: "user", entityId: user.id, summary: "Enabled TOTP multi-factor authentication" });
  revalidatePath("/settings");
  redirect("/settings?mfa=enabled");
}

export async function disableMfaAction(formData: FormData) {
  const user = await requirePermission("settings.view");
  const full = await currentFullUser();
  const password = String(formData.get("password") ?? "");
  if (!full || !verifyPassword(password, full.password_salt, full.password_hash)) redirect("/settings?error=Password+is+incorrect");
  run("UPDATE users SET mfa_enabled=0, mfa_secret=NULL WHERE id=?", [user.id]);
  logActivity({ actorId: user.id, action: "mfa.disabled", entityType: "user", entityId: user.id, summary: "Disabled multi-factor authentication" });
  revalidatePath("/settings");
  redirect("/settings?mfa=disabled");
}

export async function revokeSessionAction(formData: FormData) {
  const user = await requirePermission("settings.view");
  const sid = String(formData.get("sessionId") ?? "");
  run("UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=?", [nowIso(), sid, user.id]);
  logActivity({ actorId: user.id, action: "session.revoked", entityType: "session", entityId: sid, summary: "Revoked an active session" });
  revalidatePath("/settings");
  redirect("/settings?sessions=1");
}

export async function processEmailsAction() {
  const user = await requirePermission("settings.manage");
  const result = await processEmailOutbox();
  logActivity({ actorId: user.id, action: "email.outbox_processed", entityType: "email_outbox", summary: `Processed email outbox: ${result.sent} sent, ${result.skipped} skipped` });
  revalidatePath("/settings");
  redirect(`/settings?email=${result.sent}`);
}

export async function resetDemoAction(formData: FormData) {
  const user = await requirePermission("settings.manage");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESET") redirect("/settings?error=Type+RESET+to+confirm");
  seedDatabase(getDb());
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  logActivity({ actorId: null, action: "demo.reset", entityType: "system", summary: `Demo data reset by ${user.email}` });
  redirect("/login?reset=1");
}
