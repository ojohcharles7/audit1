import { all, get } from "@/db";
import type { Scope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";
import { getSetting } from "@/lib/settings";
import type { ListFilters } from "./common";
import { whereAudits, whereFindings } from "./common";

function monthsBack(count: number) {
  const now = new Date();
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-NG", { month: "short" }),
      start: d,
      end,
    });
  }
  return months;
}

export function dashboardData(scope: Scope, filters: ListFilters) {
  const aWhere = whereAudits(scope, filters, "a", "o");
  const scopeSql = outletScopeSql(scope, "o");
  const fWhere = whereFindings(scope, filters, "f", "o");
  const baseFilterParams = [filters.region, filters.state, filters.outlet].filter(Boolean) as string[];

  const totalOutlets = get<{ c: number }>(
    `SELECT count(*) c FROM outlets o WHERE ${scopeSql.sql} AND o.deleted_at IS NULL`,
    scopeSql.params,
  )?.c ?? 0;

  const auditCounts = all<{ status: string; c: number }>(
    `SELECT a.status, count(*) c FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${aWhere.sql} AND a.status != 'cancelled' GROUP BY a.status`,
    aWhere.params,
  );
  const byStatus = new Map(auditCounts.map((row) => [row.status, row.c]));
  const conducted =
    (byStatus.get("submitted") ?? 0) +
    (byStatus.get("under_review") ?? 0) +
    (byStatus.get("approved") ?? 0) +
    (byStatus.get("closed") ?? 0);

  const overdueAudits = get<{ c: number }>(
    `SELECT count(*) c FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${aWhere.sql} AND (a.status = 'overdue' OR (a.status IN ('scheduled','in_progress') AND a.due_date < date('now')))`,
    aWhere.params,
  )?.c ?? 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const auditedThisMonth = get<{ c: number }>(
    `SELECT count(DISTINCT a.outlet_id) c FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${scopeSql.sql} AND a.status IN ('approved','closed','submitted','under_review') AND a.completed_at >= ?`,
    [...scopeSql.params, monthStart.toISOString()],
  )?.c ?? 0;

  const highRiskOutlets = get<{ c: number }>(
    `SELECT count(*) c FROM outlets o WHERE ${scopeSql.sql} AND o.deleted_at IS NULL AND o.risk_rating IN ('high','critical')`,
    scopeSql.params,
  )?.c ?? 0;

  const openCritical = get<{ c: number }>(
    `SELECT count(*) c FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.severity = 'critical' AND f.status NOT IN ('resolved','rejected')`,
    fWhere.params,
  )?.c ?? 0;

  const discrepancies = get<{ total: number; count: number }>(
    `SELECT coalesce(sum(f.financial_impact_kobo),0) total, count(*) count FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.financial_impact_kobo > 0 AND f.status NOT IN ('resolved','rejected')`,
    fWhere.params,
  );

  const fraudWhere = scope.all
    ? { sql: "1=1", params: [] as unknown[] }
    : filters.outlet
      ? { sql: "fc.outlet_id = ?", params: [filters.outlet] as unknown[] }
      : scope.regionId
        ? { sql: "fc.outlet_id IN (SELECT id FROM outlets WHERE region_id = ?)", params: [scope.regionId] as unknown[] }
        : scope.outletIds && scope.outletIds.length
          ? { sql: `fc.outlet_id IN (${scope.outletIds.map(() => "?").join(",")})`, params: scope.outletIds as unknown[] }
          : { sql: "1=0", params: [] as unknown[] };
  const openFraud = get<{ c: number }>(
    `SELECT count(*) c FROM fraud_cases fc WHERE ${fraudWhere.sql} AND fc.status NOT IN ('closed','referred')`,
    fraudWhere.params,
  )?.c ?? 0;

  const outstandingActions = get<{ c: number }>(
    `SELECT count(*) c FROM corrective_actions ca JOIN findings f ON f.id = ca.finding_id JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND ca.status NOT IN ('closed','verified')`,
    fWhere.params,
  )?.c ?? 0;

  const avgScore = get<{ score: number }>(
    `SELECT coalesce(round(avg(a.score),1),0) score FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${aWhere.sql} AND a.score IS NOT NULL AND a.status IN ('approved','closed')`,
    aWhere.params,
  )?.score ?? 0;

  const controls = get<{ total: number; effective: number; partial: number }>(
    `SELECT count(*) total,
       coalesce(sum(CASE WHEN effectiveness = 'effective' THEN 1 ELSE 0 END),0) effective,
       coalesce(sum(CASE WHEN effectiveness = 'partially_effective' THEN 1 ELSE 0 END),0) partial
     FROM controls WHERE status = 'active'`,
  );
  const controlRate = controls?.total
    ? Math.round((((controls.effective + controls.partial * 0.5) / controls.total) * 100) * 10) / 10
    : 0;

  const recentAudits = all<{
    id: string;
    ref: string;
    title: string;
    status: string;
    score: number | null;
    planned_date: string;
    due_date: string;
    outlet_name: string;
    auditor_name: string;
  }>(
    `SELECT a.id, a.ref, a.title, a.status, a.score, a.planned_date, a.due_date, o.name outlet_name, u.name auditor_name
     FROM audits a JOIN outlets o ON o.id = a.outlet_id JOIN users u ON u.id = a.auditor_id
     WHERE ${aWhere.sql} ORDER BY a.planned_date DESC LIMIT 7`,
    aWhere.params,
  );

  const criticalFindings = all<{
    id: string;
    ref: string;
    title: string;
    severity: string;
    status: string;
    financial_impact_kobo: number;
    target_date: string;
    outlet_name: string;
  }>(
    `SELECT f.id, f.ref, f.title, f.severity, f.status, f.financial_impact_kobo, f.target_date, o.name outlet_name
     FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.severity = 'critical' AND f.status NOT IN ('resolved','rejected')
     ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'overdue' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 6`,
    fWhere.params,
  );

  const topRiskOutlets = all<{
    id: string;
    name: string;
    code: string;
    risk_rating: string;
    last_audit_score: number | null;
    open_findings: number;
    critical_findings: number;
    exposure: number;
  }>(
    `SELECT o.id, o.name, o.code, o.risk_rating, o.last_audit_score,
       (SELECT count(*) FROM findings f WHERE f.outlet_id = o.id AND f.status NOT IN ('resolved','rejected')) open_findings,
       (SELECT count(*) FROM findings f WHERE f.outlet_id = o.id AND f.severity = 'critical' AND f.status NOT IN ('resolved','rejected')) critical_findings,
       (SELECT coalesce(sum(f.financial_impact_kobo),0) FROM findings f WHERE f.outlet_id = o.id AND f.status NOT IN ('resolved','rejected')) exposure
     FROM outlets o WHERE ${scopeSql.sql} AND o.deleted_at IS NULL
     ORDER BY critical_findings DESC, CASE o.risk_rating WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, exposure DESC
     LIMIT 7`,
    scopeSql.params,
  );

  const months = monthsBack(12);
  const monthlyAudits = all<{ month: string; audits: number; score: number }>(
    `SELECT strftime('%Y-%m', a.completed_at) month, count(*) audits, round(avg(a.score),1) score
     FROM audits a JOIN outlets o ON o.id = a.outlet_id
     WHERE ${scopeSql.sql} AND a.status IN ('approved','closed') AND a.completed_at >= ?
     GROUP BY month`,
    [...scopeSql.params, months[0]!.start.toISOString()],
  );
  const monthlyFindings = all<{ month: string; findings: number; amount: number }>(
    `SELECT strftime('%Y-%m', f.created_at) month, count(*) findings, coalesce(sum(f.financial_impact_kobo),0) amount
     FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${scopeSql.sql} AND f.created_at >= ? GROUP BY month`,
    [...scopeSql.params, months[0]!.start.toISOString()],
  );
  const findingsByMonth = new Map(monthlyFindings.map((m) => [m.month, m]));
  const auditsByMonth = new Map(monthlyAudits.map((m) => [m.month, m]));

  const monthly = months.map((m) => ({
    month: m.label,
    audits: auditsByMonth.get(m.key)?.audits ?? 0,
    score: auditsByMonth.get(m.key)?.score ?? 0,
    findings: findingsByMonth.get(m.key)?.findings ?? 0,
  }));
  const discrepancyTrend = months.map((m) => ({
    month: m.label,
    amount: Math.round((findingsByMonth.get(m.key)?.amount ?? 0) / 100),
  }));

  const regionRows = all<{ name: string; score: number; audits: number }>(
    `SELECT r.name, round(avg(a.score),1) score, count(*) audits
     FROM audits a JOIN outlets o ON o.id = a.outlet_id JOIN regions r ON r.id = o.region_id
     WHERE ${aWhere.sql} AND a.score IS NOT NULL AND a.status IN ('approved','closed')
     GROUP BY r.id ORDER BY score DESC`,
    aWhere.params,
  );

  const severityRows = all<{ name: string; value: number }>(
    `SELECT f.severity name, count(*) value FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.status NOT IN ('resolved','rejected') GROUP BY f.severity`,
    fWhere.params,
  );
  const severityColor: Record<string, string> = {
    critical: "#dc2626",
    high: "#f97316",
    medium: "#f59e0b",
    low: "#10b981",
    observation: "#64748b",
  };
  const severity = ["critical", "high", "medium", "low", "observation"].map((name) => ({
    name,
    value: severityRows.find((row) => row.name === name)?.value ?? 0,
    color: severityColor[name]!,
  }));

  const categories = all<{ name: string; value: number }>(
    `SELECT f.category name, count(*) value FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.status NOT IN ('resolved','rejected') GROUP BY f.category ORDER BY value DESC LIMIT 8`,
    fWhere.params,
  );

  const repeated = all<{ name: string; value: number }>(
    `SELECT f.category name, count(*) value FROM findings f JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} AND f.is_repeated = 1 GROUP BY f.category ORDER BY value DESC LIMIT 6`,
    fWhere.params,
  );

  const actionRows = all<{ status: string; value: number }>(
    `SELECT ca.status, count(*) value FROM corrective_actions ca JOIN findings f ON f.id = ca.finding_id JOIN outlets o ON o.id = f.outlet_id
     WHERE ${fWhere.sql} GROUP BY ca.status`,
    fWhere.params,
  );
  const actionCompletion = [
    { name: "Not started", value: actionRows.find((r) => r.status === "not_started")?.value ?? 0, color: "#94a3b8" },
    { name: "In progress", value: actionRows.find((r) => r.status === "in_progress")?.value ?? 0, color: "#0e7490" },
    { name: "To verify", value: actionRows.find((r) => r.status === "awaiting_verification")?.value ?? 0, color: "#f59e0b" },
    { name: "Closed", value: (actionRows.find((r) => r.status === "closed")?.value ?? 0) + (actionRows.find((r) => r.status === "verified")?.value ?? 0), color: "#12805c" },
  ];

  const escalations = all<{
    id: string;
    created_at: string;
    reason: string;
    finding_id: string;
    severity: string;
    outlet_name: string;
  }>(
    `SELECT e.id, e.created_at, e.reason, e.finding_id, f.severity, o.name outlet_name
     FROM escalations e JOIN findings f ON f.id = e.finding_id JOIN outlets o ON o.id = f.outlet_id
     WHERE ${scopeSql.sql} ORDER BY e.created_at DESC LIMIT 5`,
    scopeSql.params,
  );

  const riskSettings = getSetting<{ critical: number; high: number; medium: number }>("risk");

  return {
    stats: {
      totalOutlets,
      conducted,
      scheduled: byStatus.get("scheduled") ?? 0,
      inProgress: byStatus.get("in_progress") ?? 0,
      completed: (byStatus.get("approved") ?? 0) + (byStatus.get("closed") ?? 0),
      overdue: overdueAudits,
      auditedThisMonth,
      highRiskOutlets,
      openCritical,
      financialExposure: discrepancies?.total ?? 0,
      discrepancyCount: discrepancies?.count ?? 0,
      openFraud,
      outstandingActions,
      avgScore,
      controlRate,
    },
    monthly,
    regions: regionRows,
    severity,
    categories,
    repeated,
    discrepancyTrend,
    actionCompletion,
    recentAudits,
    criticalFindings,
    topRiskOutlets,
    escalations,
    riskThresholds: { critical: riskSettings.critical, high: riskSettings.high, medium: riskSettings.medium },
    baseFilterParams,
  };
}

export function riskMatrixCounts(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  const rows = all<{ likelihood: number; impact: number; c: number }>(
    `SELECT r.likelihood, r.impact, count(*) c FROM risks r LEFT JOIN outlets o ON o.id = r.outlet_id
     WHERE (r.outlet_id IS NULL OR ${scopeSql.sql}) GROUP BY r.likelihood, r.impact`,
    scopeSql.params,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[`${row.likelihood}-${row.impact}`] = row.c;
  return counts;
}
