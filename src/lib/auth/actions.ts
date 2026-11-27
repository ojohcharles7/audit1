"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { newId, nowIso, run } from "@/db";
import { logActivity } from "@/lib/activity";
import { findUserByLogin, recordLogin } from "./login";
import { verifyPassword } from "./password";
import type { RoleId } from "./permissions";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  decodeSessionToken,
} from "./session-token";

export type LoginState = { error?: string };

const attempts = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const existing = (attempts.get(key) ?? []).filter((t) => t > windowStart);
  attempts.set(key, existing);
  return existing.length >= 6;
}

function recordAttempt(key: string) {
  const list = attempts.get(key) ?? [];
  list.push(Date.now());
  attempts.set(key, list);
}

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));

  if (!identifier || !password) return { error: "Enter your email and password." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
  const userAgent = h.get("user-agent") || "unknown";
  const key = `${ip}:${identifier}`;
  if (rateLimited(key)) {
    return { error: "Too many attempts. Please wait 10 minutes and try again." };
  }

  const user = await findUserByLogin(identifier);
  if (!user) {
    await recordLogin({ userId: null, email: identifier, success: false, ip, userAgent, reason: "Unknown account" });
    recordAttempt(key);
    return { error: "Invalid credentials or account is inactive." };
  }

  if (user.status !== "active" || user.deleted_at) {
    await recordLogin({ userId: user.id, email: identifier, success: false, ip, userAgent, reason: "Inactive account" });
    recordAttempt(key);
    return { error: "Invalid credentials or account is inactive." };
  }

  if (!verifyPassword(password, user.password_salt, user.password_hash)) {
    await recordLogin({ userId: user.id, email: identifier, success: false, ip, userAgent, reason: "Invalid password" });
    await logActivity({
      actorId: user.id,
      action: "login.failed",
      entityType: "session",
      summary: "Failed sign-in attempt",
      ip,
      userAgent,
    });
    recordAttempt(key);
    return { error: "Invalid credentials or account is inactive." };
  }

  if (user.mfa_enabled && user.mfa_secret) {
    if (!code) return { error: "Enter the 6-digit authenticator code." };
    const { verify } = await import("otplib");
    const result = await verify({ secret: user.mfa_secret, token: code });
    if (!result.valid) {
      await recordLogin({ userId: user.id, email: identifier, success: false, ip, userAgent, reason: "Invalid MFA code" });
      recordAttempt(key);
      return { error: "Invalid authenticator code." };
    }
  }

  attempts.delete(key);
  const sid = newId();
  const token = await createSessionToken({
    uid: user.id,
    sid,
    role: user.role as RoleId,
    name: user.name,
  });
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await run(
    "INSERT INTO sessions (id, user_id, token_id, ip, user_agent, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), user.id, sid, ip, userAgent, nowIso(), nowIso(), expiresAt],
  );
  await run("UPDATE users SET last_login_at = ? WHERE id = ?", [nowIso(), user.id]);
  await recordLogin({ userId: user.id, email: identifier, success: true, ip, userAgent });
  await logActivity({
    actorId: user.id,
    action: "login.success",
    entityType: "session",
    entityId: sid,
    summary: "User signed in",
    ip,
    userAgent,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(next);
}

export async function logoutAction() {
  const store = await cookies();
  const payload = await decodeSessionToken(store.get(SESSION_COOKIE)?.value);
  if (payload) {
    await run("UPDATE sessions SET revoked_at = ? WHERE token_id = ?", [nowIso(), payload.sid]);
    await logActivity({
      actorId: payload.uid,
      action: "logout",
      entityType: "session",
      entityId: payload.sid,
      summary: "User signed out",
    });
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
