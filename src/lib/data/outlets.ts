import { all, get } from "@/db";
import type { Scope } from "@/lib/scope";
import { canAccessOutlet, outletScopeSql } from "@/lib/scope";
import type { ListFilters } from "./common";
import type { OutletRow, AuditRow, FindingRow, ActionRow, RiskRow, DocumentRow } from "@/lib/types";

export function listOutlets(scope: Scope, filters: Partial<ListFilters> & { risk?: string }) {
  const clauses = ["o.deleted_at IS NULL"];
  const params: unknown[] = [];
  const scopeSql = outletScopeSql(scope, "o");
  clauses.push(scopeSql.sql);
  params.push(...scopeSql.params);
  if (filters.region) {
    clauses.push("o.region_id = ?");
    params.push(filters.region);
  }
  if (filters.state) {
    clauses.push("o.state_id = ?");
    params.push(filters.state);
  }
  if (filters.q) {
    clauses.push("(o.name LIKE ? OR o.code LIKE ?)");
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.risk) {
    if (filters.risk === "high") clauses.push("o.risk_rating IN ('high','critical')");
    else {
      clauses.push("o.risk_rating = ?");
      params.push(filters.risk);
    }
  }
  return all<
    OutletRow & {
      state_name: string;
      region_name: string;
      manager_name: string | null;
      open_findings: number;
      audit_count: number;
    }
  >(
    `SELECT o.*, s.name state_name, r.name region_name, u.name manager_name,
       (SELECT count(*) FROM findings f WHERE f.outlet_id = o.id AND f.status NOT IN ('resolved','rejected')) open_findings,
       (SELECT count(*) FROM audits a WHERE a.outlet_id = o.id) audit_count
     FROM outlets o JOIN states s ON s.id = o.state_id JOIN regions r ON r.id = o.region_id
     LEFT JOIN users u ON u.id = o.manager_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY CASE o.risk_rating WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, o.name`,
    params,
  );
}

export function getOutlet(scope: Scope, id: string) {
  if (!canAccessOutlet(scope, id)) return null;
  return (
    get<
      OutletRow & {
        state_name: string;
        region_name: string;
        manager_name: string | null;
        manager_email: string | null;
      }
    >(
      `SELECT o.*, s.name state_name, r.name region_name, u.name manager_name, u.email manager_email
       FROM outlets o JOIN states s ON s.id = o.state_id JOIN regions r ON r.id = o.region_id
       LEFT JOIN users u ON u.id = o.manager_id WHERE o.id = ?`,
      [id],
    ) ?? null
  );
}

export function outletDetail(scope: Scope, id: string) {
  const outlet = getOutlet(scope, id);
  if (!outlet) return null;
  const audits = all<AuditRow>(
    `SELECT a.*, u.name auditor_name FROM audits a JOIN users u ON u.id = a.auditor_id
     WHERE a.outlet_id = ? ORDER BY a.planned_date DESC LIMIT 12`,
    [id],
  );
  const findings = all<FindingRow>(
    `SELECT f.*, u.name responsible_name, a.ref audit_ref FROM findings f
     LEFT JOIN users u ON u.id = f.responsible_user_id LEFT JOIN audits a ON a.id = f.audit_id
     WHERE f.outlet_id = ? AND f.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 12`,
    [id],
  );
  const actions = all<ActionRow>(
    `SELECT ca.*, u.name officer_name, f.ref finding_ref, f.severity finding_severity
     FROM corrective_actions ca JOIN findings f ON f.id = ca.finding_id JOIN users u ON u.id = ca.officer_id
     WHERE f.outlet_id = ? ORDER BY ca.due_date ASC LIMIT 10`,
    [id],
  );
  const risks = all<RiskRow>(
    "SELECT r.*, u.name owner_name FROM risks r LEFT JOIN users u ON u.id = r.owner_id WHERE r.outlet_id = ? ORDER BY r.residual_score DESC LIMIT 10",
    [id],
  );
  const documents = all<DocumentRow>(
    `SELECT d.*, u.name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.outlet_id = ? AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 12`,
    [id],
  );
  const latestAudit = audits.find((audit) => ["approved", "closed", "submitted"].includes(audit.status));
  const categoryScores = latestAudit
    ? all<{ category: string; weight: number; earned: number }>(
        `SELECT q.category, sum(q.weight) weight,
          sum(CASE r.result WHEN 'compliant' THEN q.weight WHEN 'yes' THEN q.weight WHEN 'partial' THEN q.weight * 0.5 ELSE 0 END) earned
         FROM audit_responses r JOIN checklist_questions q ON q.id = r.question_id
         WHERE r.audit_id = ? AND r.result NOT IN ('na') AND r.result IS NOT NULL GROUP BY q.category`,
        [latestAudit.id],
      )
    : [];
  const counts = get<{
    open_findings: number;
    critical_findings: number;
    open_actions: number;
    exposure: number;
    audit_count: number;
    resolved_findings: number;
  }>(
    `SELECT
      (SELECT count(*) FROM findings f WHERE f.outlet_id = ? AND f.status NOT IN ('resolved','rejected')) open_findings,
      (SELECT count(*) FROM findings f WHERE f.outlet_id = ? AND f.severity='critical' AND f.status NOT IN ('resolved','rejected')) critical_findings,
      (SELECT count(*) FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id WHERE f.outlet_id=? AND ca.status NOT IN ('closed','verified')) open_actions,
      (SELECT coalesce(sum(financial_impact_kobo),0) FROM findings f WHERE f.outlet_id=? AND f.status NOT IN ('resolved','rejected')) exposure,
      (SELECT count(*) FROM audits a WHERE a.outlet_id=?) audit_count,
      (SELECT count(*) FROM findings f WHERE f.outlet_id=? AND f.status='resolved') resolved_findings`,
    [id, id, id, id, id, id],
  );
  return { outlet, audits, findings, actions, risks, documents, categoryScores, counts };
}

export function outletRankings(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  const rows = all<{
    id: string;
    name: string;
    code: string;
    region_name: string;
    risk_rating: string;
    last_audit_score: number | null;
    previous_score: number | null;
    open_findings: number;
    critical_findings: number;
    repeated_findings: number;
    exposure: number;
    actions_total: number;
    actions_closed: number;
  }>(
    `SELECT o.id, o.name, o.code, r.name region_name, o.risk_rating, o.last_audit_score,
      (SELECT a.score FROM audits a WHERE a.outlet_id=o.id AND a.status IN ('approved','closed') ORDER BY a.completed_at DESC LIMIT 1 OFFSET 1) previous_score,
      (SELECT count(*) FROM findings f WHERE f.outlet_id=o.id AND f.status NOT IN ('resolved','rejected')) open_findings,
      (SELECT count(*) FROM findings f WHERE f.outlet_id=o.id AND f.severity='critical' AND f.status NOT IN ('resolved','rejected')) critical_findings,
      (SELECT count(*) FROM findings f WHERE f.outlet_id=o.id AND f.is_repeated=1) repeated_findings,
      (SELECT coalesce(sum(financial_impact_kobo),0) FROM findings f WHERE f.outlet_id=o.id AND f.status NOT IN ('resolved','rejected')) exposure,
      (SELECT count(*) FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id WHERE f.outlet_id=o.id) actions_total,
      (SELECT count(*) FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id WHERE f.outlet_id=o.id AND ca.status IN ('closed','verified')) actions_closed
     FROM outlets o JOIN regions r ON r.id=o.region_id WHERE ${scopeSql.sql} AND o.deleted_at IS NULL`,
    scopeSql.params,
  );
  return rows
    .map((row) => {
      const auditScore = row.last_audit_score ?? 50;
      const actionRate = row.actions_total ? (row.actions_closed / row.actions_total) * 100 : 60;
      const exposurePenalty = Math.min(20, row.exposure / 100_000);
      const criticalPenalty = row.critical_findings * 4;
      const repeatPenalty = Math.min(15, row.repeated_findings * 2);
      const composite = Math.max(
        0,
        Math.min(100, auditScore * 0.4 + actionRate * 0.2 + 20 - exposurePenalty - criticalPenalty - repeatPenalty),
      );
      return {
        ...row,
        actionRate,
        composite: Math.round(composite * 10) / 10,
        improvement: row.last_audit_score != null && row.previous_score != null ? Math.round((row.last_audit_score - row.previous_score) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.composite - a.composite);
}

export function outletOptions(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return all<{ id: string; name: string; code: string; state_name: string; region_name: string }>(
    `SELECT o.id, o.name, o.code, s.name state_name, r.name region_name FROM outlets o
     JOIN states s ON s.id=o.state_id JOIN regions r ON r.id=o.region_id
     WHERE ${scopeSql.sql} AND o.deleted_at IS NULL ORDER BY o.name`,
    scopeSql.params,
  );
}
