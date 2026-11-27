import { SignJWT, jwtVerify } from "jose";
import type { RoleId } from "./permissions";

export const SESSION_COOKIE = "crunchies_audit_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "crunchies-audit-development-secret-change-me",
);

export type SessionPayload = {
  uid: string;
  sid: string;
  role: RoleId;
  name: string;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function decodeSessionToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.uid || !payload.sid) return null;
    return {
      uid: String(payload.uid),
      sid: String(payload.sid),
      role: String(payload.role) as RoleId,
      name: String(payload.name ?? ""),
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
