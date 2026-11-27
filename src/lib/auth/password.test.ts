import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password and rejects the wrong one", () => {
    const { salt, hash } = hashPassword("Audit@2026");
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(64);
    expect(verifyPassword("Audit@2026", salt, hash)).toBe(true);
    expect(verifyPassword("audit@2026", salt, hash)).toBe(false);
  });

  it("uses a unique salt per hash", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
