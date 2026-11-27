import crypto from "node:crypto";

const ITERATIONS = 120_000;
const KEY_LENGTH = 32;

export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password: string, salt = generateSalt()) {
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256")
    .toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
