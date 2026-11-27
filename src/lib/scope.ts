import { all, get } from "@/db";
import type { RoleId, SessionUser } from "./auth/permissions";

export type Scope = {
  userId: string;
  role: RoleId;
  all: boolean;
  regionId: string | null;
  outletId: string | null;
  outletIds: string[] | null;
};

export async function getScope(user: SessionUser): Promise<Scope> {
  if (user.role === "head_audit" || user.role === "audit_manager" || user.role === "finance" || user.role === "executive") {
    return { userId: user.id, role: user.role, all: true, regionId: null, outletId: null, outletIds: null };
  }
  if (user.role === "regional_manager") {
    return {
      userId: user.id,
      role: user.role,
      all: false,
      regionId: user.region_id,
      outletId: null,
      outletIds: null,
    };
  }
  if (user.role === "outlet_manager") {
    return {
      userId: user.id,
      role: user.role,
      all: false,
      regionId: null,
      outletId: user.outlet_id,
      outletIds: user.outlet_id ? [user.outlet_id] : [],
    };
  }
  const rows = await all<{ outlet_id: string }>(
    "SELECT DISTINCT outlet_id FROM audits WHERE auditor_id = ? UNION SELECT DISTINCT outlet_id FROM findings WHERE created_by = ?",
    [user.id, user.id],
  );
  const ids = rows.map((r) => r.outlet_id);
  return {
    userId: user.id,
    role: user.role,
    all: false,
    regionId: null,
    outletId: null,
    outletIds: ids,
  };
}

/** SQL fragment for a table joined to outlets with alias `o`. */
export function outletScopeSql(scope: Scope, alias = "o") {
  if (scope.all) return { sql: "1=1", params: [] as unknown[] };
  if (scope.regionId) return { sql: `${alias}.region_id = ?`, params: [scope.regionId] };
  const ids = scope.outletIds ?? [];
  if (ids.length === 0) return { sql: "1=0", params: [] as unknown[] };
  return { sql: `${alias}.id IN (${ids.map(() => "?").join(",")})`, params: ids };
}

/** SQL fragment for any table with an outlet_id column. */
export function outletIdScopeSql(scope: Scope, outletColumn = "outlet_id") {
  if (scope.all) return { sql: "1=1", params: [] as unknown[] };
  if (scope.regionId) {
    return {
      sql: `${outletColumn} IN (SELECT id FROM outlets WHERE region_id = ?)`,
      params: [scope.regionId],
    };
  }
  const ids = scope.outletIds ?? [];
  if (ids.length === 0) return { sql: "1=0", params: [] as unknown[] };
  return { sql: `${outletColumn} IN (${ids.map(() => "?").join(",")})`, params: ids };
}

export async function canAccessOutlet(scope: Scope, outletId: string) {
  if (scope.all) return true;
  if (scope.regionId) {
    return Boolean(await get("SELECT 1 FROM outlets WHERE id = ? AND region_id = ?", [outletId, scope.regionId]));
  }
  return (scope.outletIds ?? []).includes(outletId);
}

export async function canAccessAudit(scope: Scope, auditId: string) {
  if (scope.all) return true;
  const row = await get<{ outlet_id: string }>("SELECT outlet_id FROM audits WHERE id = ?", [auditId]);
  return row ? await canAccessOutlet(scope, row.outlet_id) : false;
}

export function canConductAudit(user: SessionUser, audit: { auditor_id: string; outlet_id: string; manager_id: string | null; created_by: string | null }) {
  if (user.role === "head_audit") return true;
  if (user.role === "audit_manager") return true;
  if (user.role === "auditor" && audit.auditor_id === user.id) return true;
  return false;
}

export async function canViewFraudCase(user: SessionUser, caseId: string) {
  if (user.role === "head_audit" || user.role === "audit_manager") return true;
  const row = await get<{ officer_id: string; created_by: string }>(
    "SELECT officer_id, created_by FROM fraud_cases WHERE id = ?",
    [caseId],
  );
  if (!row) return false;
  if (row.officer_id === user.id || row.created_by === user.id) return true;
  return Boolean(
    await get("SELECT 1 FROM case_access WHERE case_id = ? AND user_id = ?", [caseId, user.id]),
  );
}

export async function canUpdateFraudCase(user: SessionUser, caseId: string) {
  if (user.role === "head_audit" || user.role === "audit_manager") return true;
  return (await canViewFraudCase(user, caseId)) && user.role === "auditor";
}
