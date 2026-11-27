import { all, get } from "@/db";
import type { Scope } from "@/lib/scope";
import { canAccessOutlet, outletScopeSql } from "@/lib/scope";
import type { ActionRow, DocumentRow } from "@/lib/types";
import type { ListFilters } from "./common";

export async function listActions(scope: Scope, filters: Partial<ListFilters> & { priority?: string }, limit = 250) {
  const scopeSql = outletScopeSql(scope, "o");
  const clauses = ["1=1"];
  const params: unknown[] = [...scopeSql.params];
  if (filters.status === "overdue") {
    clauses.push("(ca.due_date < to_char(CURRENT_DATE,'YYYY-MM-DD') AND ca.status NOT IN ('verified','closed'))");
  } else if (filters.status) {
    clauses.push("ca.status = ?");
    params.push(filters.status);
  }
  if (filters.q) {
    clauses.push("(ca.ref ILIKE ? OR ca.description ILIKE ? OR f.ref ILIKE ? OR o.name ILIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.outlet) {
    clauses.push("f.outlet_id = ?");
    params.push(filters.outlet);
  }
  if (filters.region) {
    clauses.push("o.region_id = ?");
    params.push(filters.region);
  }
  if (filters.priority) {
    clauses.push("ca.priority = ?");
    params.push(filters.priority);
  }
  return await all<ActionRow & { outlet_name: string; finding_ref: string; finding_title: string; finding_severity: string; finding_id: string }>(
    `SELECT ca.*, u.name officer_name, o.name outlet_name, f.ref finding_ref, f.title finding_title, f.severity finding_severity, f.id finding_id
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN outlets o ON o.id=f.outlet_id JOIN users u ON u.id=ca.officer_id
     WHERE ${clauses.join(" AND ")} AND ${scopeSql.sql}
     ORDER BY CASE WHEN ca.due_date < to_char(CURRENT_DATE,'YYYY-MM-DD') AND ca.status NOT IN ('verified','closed') THEN 0 ELSE 1 END, ca.due_date ASC LIMIT ?`,
    [...params, limit],
  );
}

export async function actionStats(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return await get<{ total: number; open: number; overdue: number; verified: number; closed: number; not_started: number }>(
    `SELECT count(*) total,
      coalesce(sum(CASE WHEN ca.status NOT IN ('verified','closed') THEN 1 ELSE 0 END),0) open,
      coalesce(sum(CASE WHEN ca.due_date < to_char(CURRENT_DATE,'YYYY-MM-DD') AND ca.status NOT IN ('verified','closed') THEN 1 ELSE 0 END),0) overdue,
      coalesce(sum(CASE WHEN ca.status='verified' THEN 1 ELSE 0 END),0) verified,
      coalesce(sum(CASE WHEN ca.status='closed' THEN 1 ELSE 0 END),0) closed,
      coalesce(sum(CASE WHEN ca.status='not_started' THEN 1 ELSE 0 END),0) not_started
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN outlets o ON o.id=f.outlet_id WHERE ${scopeSql.sql}`,
    scopeSql.params,
  ) ?? { total: 0, open: 0, overdue: 0, verified: 0, closed: 0, not_started: 0 };
}

export async function getAction(scope: Scope, id: string) {
  const action = await get<ActionRow & {
    outlet_id: string;
    outlet_name: string;
    finding_ref: string;
    finding_title: string;
    finding_severity: string;
    finding_status: string;
    finding_id: string;
    officer_name: string;
    officer_email: string;
    verifier_name: string | null;
    closer_name: string | null;
  }>(
    `SELECT ca.*, o.id outlet_id, o.name outlet_name, f.ref finding_ref, f.title finding_title, f.severity finding_severity, f.status finding_status,
      u.name officer_name, u.email officer_email, v.name verifier_name, c.name closer_name
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN outlets o ON o.id=f.outlet_id
     JOIN users u ON u.id=ca.officer_id LEFT JOIN users v ON v.id=ca.verified_by LEFT JOIN users c ON c.id=ca.closed_by
     WHERE ca.id=?`,
    [id],
  );
  if (!action || !(await canAccessOutlet(scope, action.outlet_id))) return null;
  const documents = await all<DocumentRow & { uploaded_by_name: string | null }>(
    "SELECT d.*, u.name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.action_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC",
    [id],
  );
  const findingHistory = await all<{ id: string; action: string; to_status: string | null; note: string | null; created_at: string; actor_name: string | null }>(
    `SELECT h.id, h.action, h.to_status, h.note, h.created_at, u.name actor_name FROM finding_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.finding_id=? ORDER BY h.created_at DESC LIMIT 20`,
    [action.finding_id],
  );
  return { action, documents, findingHistory };
}
