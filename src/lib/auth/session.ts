import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "@/db";
import {
  can,
  permissionForPath,
  type Permission,
  type RoleId,
  type SessionUser,
} from "./permissions";
import { SESSION_COOKIE, decodeSessionToken } from "./session-token";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  title: string;
  initials: string;
  outlet_id: string | null;
  region_id: string | null;
  mfa_enabled: number;
  status: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = await decodeSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const user = get<UserRow>(
    "SELECT u.id, u.name, u.email, u.role, u.title, u.initials, u.outlet_id, u.region_id, u.mfa_enabled, u.status " +
      "FROM users u JOIN sessions s ON s.user_id = u.id " +
      "WHERE u.id = ? AND s.token_id = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL AND u.status = 'active'",
    [payload.uid, payload.sid, new Date().toISOString()],
  );

  if (!user) return null;
  run("UPDATE sessions SET last_seen_at = ? WHERE token_id = ?", [
    new Date().toISOString(),
    payload.sid,
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    initials: user.initials,
    outlet_id: user.outlet_id,
    region_id: user.region_id,
    mfa_enabled: user.mfa_enabled,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/dashboard?denied=" + encodeURIComponent(permission));
  return user;
}

export async function requireRouteAccess(pathname: string): Promise<SessionUser> {
  const user = await requireUser();
  const permission = permissionForPath(pathname);
  if (permission && !can(user, permission)) {
    redirect("/dashboard?denied=" + encodeURIComponent(permission));
  }
  return user;
}

export async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "127.0.0.1";
  return { ip, userAgent: h.get("user-agent") || "unknown" };
}

export async function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  const allowed = new Set(
    [process.env.APP_URL, host ? `http://${host}` : null, host ? `https://${host}` : null].filter(
      Boolean,
    ) as string[],
  );
  return allowed.has(origin);
}
