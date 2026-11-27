import { all } from "@/db";
import type { Scope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";

export type Lookup = { id: string; name: string; code?: string; region_id?: string | null; state_id?: string | null };

export async function regions(): Promise<Lookup[]> {
  return await all<Lookup>("SELECT id, name, code FROM regions ORDER BY name");
}

export async function states(regionId?: string): Promise<Lookup[]> {
  if (regionId) {
    return await all<Lookup>("SELECT id, name, region_id FROM states WHERE region_id = ? ORDER BY name", [regionId]);
  }
  return await all<Lookup>("SELECT id, name, region_id FROM states ORDER BY name");
}

export async function outletsForScope(scope: Scope, regionId?: string) {
  const scopeSql = outletScopeSql(scope, "o");
  const params: unknown[] = [...scopeSql.params];
  let extra = "";
  if (regionId) {
    extra = " AND o.region_id = ?";
    params.push(regionId);
  }
  return await all<Lookup & { region_name: string; state_name: string; risk_rating: string }>(
    `SELECT o.id, o.name, o.code, o.region_id, o.state_id, o.risk_rating, r.name as region_name, s.name as state_name
     FROM outlets o JOIN regions r ON r.id = o.region_id JOIN states s ON s.id = o.state_id
     WHERE ${scopeSql.sql} AND o.deleted_at IS NULL ${extra} ORDER BY o.name`,
    params,
  );
}

export async function auditors() {
  return await all<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE role = 'auditor' AND deleted_at IS NULL ORDER BY name",
  );
}

export async function staffList() {
  return await all<Lookup & { email: string; role: string }>(
    "SELECT id, name, email, role FROM users WHERE deleted_at IS NULL AND status = 'active' ORDER BY name",
  );
}

export async function templates() {
  return await all<Lookup & { category: string; question_count: number }>(
    "SELECT t.id, t.name, t.code, t.category, count(q.id) as question_count FROM audit_templates t LEFT JOIN checklist_questions q ON q.template_id = t.id AND q.active = 1 WHERE t.active = 1 GROUP BY t.id ORDER BY t.name",
  );
}

export async function approvedAuditsForReports(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<{ id: string; ref: string; title: string; outlet_name: string }>(
    `SELECT a.id, a.ref, a.title, o.name as outlet_name FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${scopeSql.sql} AND a.status IN ('approved','closed') ORDER BY a.completed_at DESC LIMIT 100`,
    scopeSql.params,
  );
}

export async function allAuditsForSelect(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<{ id: string; ref: string; title: string; outlet_name: string }>(
    `SELECT a.id, a.ref, a.title, o.name as outlet_name FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${scopeSql.sql} ORDER BY a.planned_date DESC LIMIT 200`,
    scopeSql.params,
  );
}
