import { all, get, newId, nowIso, run } from "@/db";

export type LoginUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mfa_enabled: number;
  mfa_secret: string | null;
  password_salt: string;
  password_hash: string;
  deleted_at: string | null;
};

export function findUserByLogin(identifier: string) {
  return get<LoginUser>(
    "SELECT id, name, email, role, status, mfa_enabled, mfa_secret, password_salt, password_hash, deleted_at FROM users WHERE lower(email) = ? OR lower(email) LIKE ? ORDER BY CASE WHEN lower(email) = ? THEN 0 ELSE 1 END LIMIT 1",
    [identifier, `${identifier}@%`, identifier],
  );
}

export function recordLogin(input: {
  userId: string | null;
  email: string;
  success: boolean;
  ip: string;
  userAgent: string;
  reason?: string | null;
}) {
  run(
    "INSERT INTO login_history (id, user_id, email, success, ip, user_agent, reason, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), input.userId, input.email, input.success ? 1 : 0, input.ip, input.userAgent, input.reason ?? null, nowIso()],
  );
}

export function recentLogins(userId: string, limit = 5) {
  return all(
    "SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit],
  );
}
