import { all, get } from "@/db";
import type { Scope } from "@/lib/scope";
import { canAccessOutlet, outletScopeSql } from "@/lib/scope";
import type { ActionRow, DocumentRow, FindingRow } from "@/lib/types";
import type { ListFilters } from "./common";
import { whereFindings } from "./common";

export function listFindings(scope: Scope, filters: Partial<ListFilters>, limit = 250) {
  const where = whereFindings(scope, filters);
  return all<
    FindingRow & {
      outlet_name: string;
      outlet_code: string;
      region_name: string;
      audit_ref: string | null;
      responsible_name: string | null;
      action_count: number;
    }
  >(
    `SELECT f.*, o.name outlet_name, o.code outlet_code, r.name region_name, a.ref audit_ref, u.name responsible_name,
       (SELECT count(*) FROM corrective_actions ca WHERE ca.finding_id=f.id) action_count
     FROM findings f JOIN outlets o ON o.id=f.outlet_id JOIN regions r ON r.id=o.region_id
     LEFT JOIN audits a ON a.id=f.audit_id LEFT JOIN users u ON u.id=f.responsible_user_id
     WHERE ${where.sql} AND f.deleted_at IS NULL
     ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, f.created_at DESC LIMIT ?`,
    [...where.params, limit],
  );
}

export function findingStats(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return get<{
    total: number;
    open: number;
    critical: number;
    overdue: number;
    exposure: number;
    resolved: number;
  }>(
    `SELECT count(*) total,
      coalesce(sum(CASE WHEN f.status NOT IN ('resolved','rejected') THEN 1 ELSE 0 END),0) open,
      coalesce(sum(CASE WHEN f.severity='critical' AND f.status NOT IN ('resolved','rejected') THEN 1 ELSE 0 END),0) critical,
      coalesce(sum(CASE WHEN f.status='overdue' OR (f.status NOT IN ('resolved','rejected') AND f.target_date < date('now')) THEN 1 ELSE 0 END),0) overdue,
      coalesce(sum(CASE WHEN f.status NOT IN ('resolved','rejected') THEN f.financial_impact_kobo ELSE 0 END),0) exposure,
      coalesce(sum(CASE WHEN f.status='resolved' THEN 1 ELSE 0 END),0) resolved
     FROM findings f JOIN outlets o ON o.id=f.outlet_id WHERE ${scopeSql.sql} AND f.deleted_at IS NULL`,
    scopeSql.params,
  ) ?? { total: 0, open: 0, critical: 0, overdue: 0, exposure: 0, resolved: 0 };
}

export function getFinding(scope: Scope, id: string) {
  const finding = get<
    FindingRow & {
      outlet_name: string;
      outlet_code: string;
      outlet_region: string;
      outlet_manager_name: string | null;
      audit_ref: string | null;
      audit_title: string | null;
      responsible_name: string | null;
      responsible_email: string | null;
      creator_name: string | null;
      verifier_name: string | null;
      closed_name: string | null;
    }
  >(
    `SELECT f.*, o.name outlet_name, o.code outlet_code, o.region_id outlet_region, om.name outlet_manager_name,
      a.ref audit_ref, a.title audit_title, u.name responsible_name, u.email responsible_email,
      c.name creator_name, v.name verifier_name, cl.name closed_name
     FROM findings f JOIN outlets o ON o.id=f.outlet_id
     LEFT JOIN users om ON om.id=o.manager_id LEFT JOIN audits a ON a.id=f.audit_id
     LEFT JOIN users u ON u.id=f.responsible_user_id LEFT JOIN users c ON c.id=f.created_by
     LEFT JOIN users v ON v.id=f.verified_by LEFT JOIN users cl ON cl.id=f.closed_by
     WHERE f.id = ?`,
    [id],
  );
  if (!finding || !canAccessOutlet(scope, finding.outlet_id)) return null;
  const actions = all<ActionRow>(
    `SELECT ca.*, u.name officer_name, f.ref finding_ref, f.title finding_title
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN users u ON u.id=ca.officer_id
     WHERE ca.finding_id=? ORDER BY ca.created_at`,
    [id],
  );
  const history = all<{
    id: string;
    action: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    actor_name: string | null;
    created_at: string;
  }>(
    `SELECT h.*, u.name actor_name FROM finding_history h LEFT JOIN users u ON u.id=h.actor_id
     WHERE h.finding_id=? ORDER BY h.created_at DESC`,
    [id],
  );
  const evidence = all<DocumentRow & { uploaded_by_name: string | null }>(
    `SELECT d.*, u.name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by
     WHERE d.finding_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
    [id],
  );
  const escalations = all<{ id: string; reason: string; level: string; created_at: string; acknowledged_at: string | null }>(
    "SELECT * FROM escalations WHERE finding_id=? ORDER BY created_at DESC",
    [id],
  );
  const sourceQuestion = finding.source_response_id
    ? get<{ text: string; expected_control: string | null; procedure: string | null; risk_level: string }>(
        `SELECT q.text, q.expected_control, q.procedure, q.risk_level FROM audit_responses r JOIN checklist_questions q ON q.id=r.question_id WHERE r.id=?`,
        [finding.source_response_id],
      )
    : undefined;
  return { finding, actions, history, evidence, escalations, sourceQuestion };
}

export function findingOptions(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return all<{ id: string; name: string }>(
    `SELECT o.id, o.name FROM outlets o WHERE ${scopeSql.sql} AND o.deleted_at IS NULL ORDER BY o.name`,
    scopeSql.params,
  );
}
