import { describe, expect, it } from "vitest";
import { can, permissionsFor, ROLE_PERMISSIONS } from "./permissions";

describe("role-based access control", () => {
  it("gives the Head of Audit organisation-wide authority", () => {
    expect(can({ role: "head_audit" }, "settings.manage")).toBe(true);
    expect(can({ role: "head_audit" }, "findings.close")).toBe(true);
    expect(can({ role: "head_audit" }, "fraud.manage")).toBe(true);
  });

  it("does not let outlet managers close findings or open fraud", () => {
    expect(can({ role: "outlet_manager" }, "findings.respond")).toBe(true);
    expect(can({ role: "outlet_manager" }, "findings.verify")).toBe(false);
    expect(can({ role: "outlet_manager" }, "findings.close")).toBe(false);
    expect(can({ role: "outlet_manager" }, "fraud.view")).toBe(false);
  });

  it("keeps executive access read-only", () => {
    expect(can({ role: "executive" }, "dashboard.view")).toBe(true);
    expect(can({ role: "executive" }, "reports.view")).toBe(true);
    expect(can({ role: "executive" }, "findings.create")).toBe(false);
    expect(can({ role: "executive" }, "findings.respond")).toBe(false);
  });

  it("does not let auditors approve audits", () => {
    expect(can({ role: "auditor" }, "audits.conduct")).toBe(true);
    expect(can({ role: "auditor" }, "audits.approve")).toBe(false);
    expect(can({ role: "auditor" }, "settings.manage")).toBe(false);
  });

  it("denies anonymous access and keeps permissions unique", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    for (const [, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(new Set(permissions).size).toBe(permissions.length);
    }
    expect(permissionsFor("finance").length).toBeGreaterThan(0);
  });
});
