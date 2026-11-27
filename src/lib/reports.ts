import { all, get, newId, nextYearRef, nowIso, run } from "@/db";
import type { Scope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";
import type { ReportSnapshot } from "@/lib/types";
import type { SessionUser } from "./auth/permissions";
import { categoryLabel } from "./constants";
import { formatDate, formatMoney, percent, titleCase } from "./format";
import { getSetting } from "./settings";
import { logActivity } from "./activity";

export const REPORT_KINDS = [
  { id: "audit", label: "Outlet Audit Report", description: "Full report for a completed outlet audit." },
  { id: "monthly", label: "Monthly Internal Audit Report", description: "Coverage, findings and remediation for the month." },
  { id: "quarterly", label: "Quarterly Audit Report", description: "Quarterly assurance summary." },
  { id: "annual", label: "Annual Audit Report", description: "Annual audit performance and control environment." },
  { id: "outlet_performance", label: "Outlet Audit Performance", description: "Outlet ranking and compliance comparison." },
  { id: "regional_performance", label: "Regional Audit Performance", description: "Region-level assurance comparison." },
  { id: "financial_irregularities", label: "Financial Irregularities Report", description: "Open financial exceptions and exposure." },
  { id: "inventory_variance", label: "Inventory Variance Report", description: "Stock variances, losses and inventory findings." },
  { id: "fraud_investigation", label: "Fraud Investigation Report", description: "Confidential case summary and status." },
  { id: "internal_control", label: "Internal Control Assessment", description: "Control testing and effectiveness." },
  { id: "compliance", label: "Compliance Report", description: "Regulatory and internal compliance position." },
  { id: "outstanding_findings", label: "Outstanding Audit Findings", description: "All unresolved findings by severity and owner." },
  { id: "corrective_actions", label: "Corrective Action Report", description: "Action progress, verification and overdue items." },
  { id: "auditor_productivity", label: "Auditor Productivity Report", description: "Audits completed and findings per auditor." },
  { id: "risk_assessment", label: "Risk Assessment Report", description: "Enterprise risk register and heat map." },
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number]["id"];

function metaFor(title: string, subtitle: string, period: string, preparedBy: string, reference = "Management report") {
  const org = getSetting<{ name: string; department: string }>("org");
  return {
    org: org.name,
    department: org.department,
    title,
    subtitle,
    period,
    confidentiality: "CONFIDENTIAL — Internal Use Only",
    preparedBy,
    generatedAt: nowIso(),
    reference,
  };
}

export function buildAuditSnapshot(auditId: string): ReportSnapshot | null {
  const audit = get<{
    ref: string;
    title: string;
    status: string;
    category: string;
    planned_date: string;
    completed_at: string | null;
    objectives: string | null;
    scope: string | null;
    methodology: string | null;
    score: number | null;
    compliance_rate: number | null;
    risk_rating: string | null;
    outlet_name: string;
    outlet_code: string;
    outlet_address: string;
    state_name: string;
    region_name: string;
    auditor_name: string;
    template_name: string;
  }>(
    `SELECT a.ref, a.title, a.status, a.category, a.planned_date, a.completed_at, a.objectives, a.scope, a.methodology, a.score, a.compliance_rate, a.risk_rating,
      o.name outlet_name, o.code outlet_code, o.address outlet_address, s.name state_name, r.name region_name, u.name auditor_name, t.name template_name
     FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN states s ON s.id=o.state_id JOIN regions r ON r.id=o.region_id
     JOIN users u ON u.id=a.auditor_id JOIN audit_templates t ON t.id=a.template_id WHERE a.id=?`,
    [auditId],
  );
  if (!audit) return null;
  const findings = all<{
    ref: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    financial_impact_kobo: number;
    recommendation: string | null;
    management_response: string | null;
    target_date: string | null;
  }>("SELECT * FROM findings WHERE audit_id=? AND deleted_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END", [auditId]);
  const categoryScores = all<{ category: string; weight: number; earned: number }>(
    `SELECT q.category, sum(q.weight) weight,
       sum(CASE r.result WHEN 'compliant' THEN q.weight WHEN 'yes' THEN q.weight WHEN 'partial' THEN q.weight * 0.5 ELSE 0 END) earned
     FROM audit_responses r JOIN checklist_questions q ON q.id=r.question_id
     WHERE r.audit_id=? AND r.result NOT IN ('na') GROUP BY q.category`,
    [auditId],
  );
  const actions = all<{ ref: string; description: string; officer_name: string; due_date: string; progress: number; status: string }>(
    `SELECT ca.ref, ca.description, u.name officer_name, ca.due_date, ca.progress, ca.status
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN users u ON u.id=ca.officer_id WHERE f.audit_id=?`,
    [auditId],
  );
  const exposure = findings.reduce((sum, finding) => sum + finding.financial_impact_kobo, 0);
  const snapshot: ReportSnapshot = {
    meta: metaFor(
      `Internal Audit Report — ${audit.outlet_name}`,
      audit.ref,
      `${formatDate(audit.planned_date)} to ${formatDate(audit.completed_at)}`,
      audit.auditor_name,
      audit.ref,
    ),
    summary: [
      { label: "Outlet", value: audit.outlet_name },
      { label: "Overall score", value: percent(audit.score, 1) },
      { label: "Compliance rate", value: percent(audit.compliance_rate, 1) },
      { label: "Findings", value: String(findings.length) },
      { label: "Financial exposure", value: formatMoney(exposure) },
    ],
    sections: [
      {
        heading: "1. Organisation and outlet details",
        body: `${audit.outlet_name} (${audit.outlet_code}) · ${audit.outlet_address} · ${audit.state_name} State · ${audit.region_name} Region.`,
      },
      {
        heading: "2. Audit reference, period and team",
        columns: ["Field", "Detail"],
        rows: [
          ["Audit reference", audit.ref],
          ["Audit period", `${formatDate(audit.planned_date)} to ${formatDate(audit.completed_at)}`],
          ["Auditor", audit.auditor_name],
          ["Template", audit.template_name],
          ["Risk rating", titleCase(audit.risk_rating ?? "—")],
        ],
      },
      {
        heading: "3. Objectives, scope and methodology",
        body: `Objectives: ${audit.objectives ?? "—"}\n\nScope: ${audit.scope ?? "—"}\n\nMethodology: ${audit.methodology ?? "—"}`,
      },
      {
        heading: "4. Executive summary",
        body: `${audit.outlet_name} achieved an overall weighted audit score of ${percent(audit.score, 1)} across ${audit.template_name.toLowerCase()} controls. ${findings.length} finding${findings.length === 1 ? "" : "s"} were raised with a combined identified exposure of ${formatMoney(exposure)}.`,
      },
      {
        heading: "5. Category scores",
        columns: ["Audit category", "Weighted score"],
        rows: categoryScores.map((row) => [categoryLabel(row.category), percent(row.weight ? (row.earned / row.weight) * 100 : 0, 1)]),
      },
      {
        heading: "6. Detailed audit observations",
        columns: ["Reference", "Severity", "Observation", "Status", "Financial impact"],
        rows: findings.map((finding) => [
          finding.ref,
          titleCase(finding.severity),
          finding.title,
          titleCase(finding.status),
          formatMoney(finding.financial_impact_kobo),
        ]),
      },
      {
        heading: "7. Financial discrepancies and exposure",
        body: `Total identified financial exposure: ${formatMoney(exposure)}. Financial discrepancies are traceable to source records and evidence held in the audit repository.`,
      },
      {
        heading: "8. Recommendations and management responses",
        columns: ["Finding", "Recommendation", "Management response", "Target date"],
        rows: findings.map((finding) => [
          finding.ref,
          finding.recommendation ?? "—",
          finding.management_response ?? "Response pending",
          formatDate(finding.target_date),
        ]),
      },
      {
        heading: "9. Corrective action plan",
        columns: ["Action", "Description", "Owner", "Due", "Progress", "Status"],
        rows: actions.map((action) => [
          action.ref,
          action.description,
          action.officer_name,
          formatDate(action.due_date),
          `${action.progress}%`,
          titleCase(action.status),
        ]),
      },
      {
        heading: "10. Auditor's conclusion",
        body:
          (audit.score ?? 0) >= 85
            ? "The internal control environment is satisfactory. Focused remediation of the observations raised will further strengthen assurance."
            : (audit.score ?? 0) >= 70
              ? "The control environment requires improvement. Management should implement the agreed corrective actions within the stated timelines."
              : "The control environment is weak. Immediate management action and follow-up verification are required.",
      },
    ],
    approval: [
      { role: "Prepared by", name: audit.auditor_name, date: formatDate(audit.completed_at) },
      { role: "Reviewed by", name: "Internal Audit Manager", date: formatDate(audit.completed_at) },
      { role: "Approved by", name: "Head of Internal Audit", date: formatDate(nowIso()) },
    ],
  };
  return snapshot;
}

export function buildManagementSnapshot(
  kind: Exclude<ReportKind, "audit">,
  scope: Scope,
  user: SessionUser,
  from: string,
  to: string,
): ReportSnapshot {
  const scopeSql = outletScopeSql(scope, "o");
  const auditRows = all<{
    id: string;
    ref: string;
    title: string;
    status: string;
    score: number | null;
    planned_date: string;
    completed_at: string | null;
    outlet_name: string;
    auditor_name: string;
    category: string;
  }>(
    `SELECT a.id, a.ref, a.title, a.status, a.score, a.planned_date, a.completed_at, o.name outlet_name, u.name auditor_name, a.category
     FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN users u ON u.id=a.auditor_id
     WHERE ${scopeSql.sql} AND a.planned_date BETWEEN ? AND ? ORDER BY a.planned_date DESC`,
    [...scopeSql.params, from, to],
  );
  const findingRows = all<{
    ref: string;
    title: string;
    severity: string;
    status: string;
    financial_impact_kobo: number;
    outlet_name: string;
    category: string;
    target_date: string | null;
    responsible_name: string | null;
  }>(
    `SELECT f.ref, f.title, f.severity, f.status, f.financial_impact_kobo, o.name outlet_name, f.category, f.target_date, u.name responsible_name
     FROM findings f JOIN outlets o ON o.id=f.outlet_id LEFT JOIN users u ON u.id=f.responsible_user_id
     WHERE ${scopeSql.sql} AND f.created_at BETWEEN ? AND ? AND f.deleted_at IS NULL ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
    [...scopeSql.params, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  const actionRows = all<{
    ref: string;
    description: string;
    status: string;
    progress: number;
    due_date: string;
    officer_name: string;
    finding_ref: string;
  }>(
    `SELECT ca.ref, ca.description, ca.status, ca.progress, ca.due_date, u.name officer_name, f.ref finding_ref
     FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id JOIN users u ON u.id=ca.officer_id
     WHERE ${scopeSql.sql} AND f.created_at BETWEEN ? AND ? ORDER BY ca.due_date`,
    [...scopeSql.params, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  const riskRows = all<{
    ref: string;
    title: string;
    category: string;
    likelihood: number;
    impact: number;
    residual_score: number;
    rating: string;
    owner_name: string | null;
    review_date: string | null;
  }>(
    `SELECT r.ref, r.title, r.category, r.likelihood, r.impact, r.residual_score, r.rating, u.name owner_name, r.review_date
     FROM risks r LEFT JOIN outlets o ON o.id=r.outlet_id LEFT JOIN users u ON u.id=r.owner_id
     WHERE (r.outlet_id IS NULL OR ${scopeSql.sql}) ORDER BY r.residual_score DESC`,
    scopeSql.params,
  );
  const controlRows = all<{
    control_ref: string;
    name: string;
    department: string;
    effectiveness: string;
    last_tested_at: string | null;
    next_test_at: string | null;
  }>(
    "SELECT control_ref, name, department, effectiveness, last_tested_at, next_test_at FROM controls ORDER BY department, name",
  );
  const fraudScopeWhere = scope.all
    ? "1=1"
    : scope.regionId
      ? "fc.outlet_id IN (SELECT id FROM outlets WHERE region_id = ?)"
      : scope.outletIds && scope.outletIds.length
        ? `fc.outlet_id IN (${scope.outletIds.map(() => "?").join(",")})`
        : "1=0";
  const fraudParams = scope.all ? [] : scope.regionId ? [scope.regionId] : scope.outletIds ?? [];
  const fraudSummary = get<{ total: number; open: number; exposure: number }>(
    `SELECT count(*) total,
       coalesce(sum(CASE WHEN fc.status NOT IN ('closed','referred') THEN 1 ELSE 0 END),0) open,
       coalesce(sum(fc.suspected_exposure_kobo),0) exposure
     FROM fraud_cases fc WHERE ${fraudScopeWhere}`,
    fraudParams,
  );
  const completed = auditRows.filter((a) => ["approved", "closed"].includes(a.status));
  const avgScore = completed.length ? completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / completed.length : 0;
  const openFindings = findingRows.filter((f) => !["resolved", "rejected"].includes(f.status));
  const exposure = openFindings.reduce((sum, f) => sum + f.financial_impact_kobo, 0);
  const canSeeFraud = user.role === "head_audit" || user.role === "audit_manager" || user.role === "auditor";
  const title = REPORT_KINDS.find((item) => item.id === kind)?.label ?? "Management Report";
  const org = getSetting<{ name: string; department: string }>("org");
  const baseSummary = [
    { label: "Audits in period", value: String(auditRows.length) },
    { label: "Completed audits", value: String(completed.length) },
    { label: "Average score", value: percent(avgScore, 1) },
    { label: "Open findings", value: String(openFindings.length) },
    { label: "Financial exposure", value: formatMoney(exposure) },
    { label: "Open corrective actions", value: String(actionRows.filter((a) => !["closed", "verified"].includes(a.status)).length) },
  ];

  const sections: ReportSnapshot["sections"] = [
    {
      heading: "Audit coverage",
      columns: ["Reference", "Outlet", "Category", "Auditor", "Status", "Score", "Planned"],
      rows: auditRows.slice(0, 60).map((audit) => [
        audit.ref,
        audit.outlet_name,
        categoryLabel(audit.category),
        audit.auditor_name,
        titleCase(audit.status),
        audit.score != null ? `${audit.score}%` : "—",
        formatDate(audit.planned_date),
      ]),
    },
    {
      heading: "Findings by severity",
      columns: ["Severity", "Count"],
      rows: ["critical", "high", "medium", "low", "observation"].map((severity) => [
        titleCase(severity),
        String(openFindings.filter((finding) => finding.severity === severity).length),
      ]),
    },
    {
      heading: "Findings requiring attention",
      columns: ["Reference", "Outlet", "Severity", "Finding", "Status", "Exposure"],
      rows: openFindings.slice(0, 40).map((finding) => [
        finding.ref,
        finding.outlet_name,
        titleCase(finding.severity),
        finding.title,
        titleCase(finding.status),
        formatMoney(finding.financial_impact_kobo),
      ]),
    },
    {
      heading: "Corrective action performance",
      columns: ["Action", "Finding", "Owner", "Due", "Progress", "Status"],
      rows: actionRows.slice(0, 40).map((action) => [
        action.ref,
        action.finding_ref,
        action.officer_name,
        formatDate(action.due_date),
        `${action.progress}%`,
        titleCase(action.status),
      ]),
    },
  ];

  if (kind === "risk_assessment" || kind === "annual" || kind === "quarterly") {
    sections.push({
      heading: "Enterprise risk register",
      columns: ["Reference", "Risk", "Category", "L×I", "Residual", "Rating", "Owner", "Review"],
      rows: riskRows.slice(0, 40).map((risk) => [
        risk.ref,
        risk.title,
        risk.category,
        `${risk.likelihood}×${risk.impact}`,
        String(risk.residual_score),
        titleCase(risk.rating),
        risk.owner_name ?? "—",
        formatDate(risk.review_date),
      ]),
    });
  }

  if (kind === "internal_control" || kind === "annual" || kind === "compliance") {
    sections.push({
      heading: "Internal control assessment",
      columns: ["Control", "Name", "Department", "Effectiveness", "Last tested", "Next test"],
      rows: controlRows.map((control) => [
        control.control_ref,
        control.name,
        control.department,
        titleCase(control.effectiveness),
        formatDate(control.last_tested_at),
        formatDate(control.next_test_at),
      ]),
    });
  }

  if (kind === "fraud_investigation") {
    sections.push({
      heading: "Confidential investigation summary",
      body: canSeeFraud
        ? `There are ${fraudSummary?.open ?? 0} open investigations with suspected exposure of ${formatMoney(fraudSummary?.exposure ?? 0)}. Case-level information is available only within the restricted investigation module.`
        : `There are ${fraudSummary?.open ?? 0} open investigations. Detailed case information is restricted to authorised investigation personnel.`,
    });
  }

  if (kind === "outlet_performance" || kind === "regional_performance") {
    const groups = all<{ name: string; score: number; audits: number }>(
      `SELECT ${kind === "regional_performance" ? "r.name" : "o.name"} name, round(avg(a.score),1) score, count(*) audits
       FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN regions r ON r.id=o.region_id
       WHERE ${scopeSql.sql} AND a.status IN ('approved','closed') AND a.planned_date BETWEEN ? AND ?
       GROUP BY 1 ORDER BY score DESC`,
      [...scopeSql.params, from, to],
    );
    sections.push({
      heading: kind === "regional_performance" ? "Regional performance" : "Outlet performance",
      columns: ["Name", "Average score", "Audits"],
      rows: groups.map((group) => [group.name, `${group.score}%`, String(group.audits)]),
    });
  }

  if (kind === "auditor_productivity") {
    const productivity = all<{ name: string; audits: number; avg_score: number; findings: number }>(
      `SELECT u.name, count(DISTINCT a.id) audits, round(avg(a.score),1) avg_score,
        (SELECT count(*) FROM findings f WHERE f.created_by=u.id) findings
       FROM users u LEFT JOIN audits a ON a.auditor_id=u.id AND a.planned_date BETWEEN ? AND ?
       WHERE u.role='auditor' AND u.deleted_at IS NULL GROUP BY u.id ORDER BY audits DESC`,
      [from, to],
    );
    sections.push({
      heading: "Auditor productivity",
      columns: ["Auditor", "Audits", "Average score", "Findings raised"],
      rows: productivity.map((row) => [row.name, String(row.audits), row.avg_score != null ? `${row.avg_score}%` : "—", String(row.findings)]),
    });
  }

  return {
    meta: metaFor(
      `${title} — ${org.name}`,
      `${outletScopeLabel(scope)} assurance summary`,
      `${formatDate(from)} to ${formatDate(to)}`,
      user.name,
    ),
    summary: baseSummary,
    sections,
    approval: [
      { role: "Prepared by", name: user.name, date: formatDate(nowIso()) },
      { role: "Approved by", name: "Head of Internal Audit", date: formatDate(nowIso()) },
    ],
  };
}

function outletScopeLabel(scope: Scope) {
  if (scope.all) return "Organisation-wide";
  if (scope.regionId) return "Regional";
  return "Outlet";
}

export function createReportRecord(input: {
  user: SessionUser;
  scope: Scope;
  kind: ReportKind;
  auditId?: string | null;
  from: string;
  to: string;
}) {
  const snapshot =
    input.kind === "audit" && input.auditId
      ? buildAuditSnapshot(input.auditId)
      : input.kind === "audit"
        ? null
        : buildManagementSnapshot(input.kind as Exclude<ReportKind, "audit">, input.scope, input.user, input.from, input.to);
  if (!snapshot) return null;
  const id = newId();
  const ref = nextYearRef("report", "RPT");
  const auditId = input.kind === "audit" ? input.auditId ?? null : null;
  const previousVersion = auditId
    ? get<{ v: number }>("SELECT coalesce(max(version),0) v FROM audit_reports WHERE audit_id=?", [auditId])?.v ?? 0
    : 0;
  const version = previousVersion + 1;
  run(
    "INSERT INTO audit_reports (id, report_ref, audit_id, kind, title, period_start, period_end, version, status, confidentiality, snapshot_json, generated_by, generated_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      id,
      ref,
      auditId,
      input.kind,
      snapshot.meta.title,
      input.from,
      input.to,
      version,
      "submitted",
      "confidential",
      JSON.stringify(snapshot),
      input.user.id,
      nowIso(),
      nowIso(),
    ],
  );
  logActivity({
    actorId: input.user.id,
    action: "report.generated",
    entityType: "audit_report",
    entityId: id,
    summary: `Generated ${snapshot.meta.title}`,
    metadata: { kind: input.kind, auditId },
  });
  return { id, ref };
}

export function listReports(
  scope: Scope,
  user: SessionUser,
  filters: { q?: string; kind?: string },
) {
  const clauses = ["1=1"];
  const params: unknown[] = [];
  if (user.role !== "head_audit" && user.role !== "executive" && user.role !== "audit_manager") {
    clauses.push("(r.generated_by = ? OR a.outlet_id IN (SELECT o.id FROM outlets o WHERE " + outletScopeSql(scope, "o").sql + "))");
    params.push(user.id, ...outletScopeSql(scope, "o").params);
  }
  if (filters.kind) {
    clauses.push("r.kind = ?");
    params.push(filters.kind);
  }
  if (filters.q) {
    clauses.push("(r.title LIKE ? OR r.report_ref LIKE ?)");
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  return all<{
    id: string;
    report_ref: string;
    kind: string;
    title: string;
    status: string;
    confidentiality: string;
    generated_at: string;
    generated_by_name: string | null;
    audit_ref: string | null;
  }>(
    `SELECT r.id, r.report_ref, r.kind, r.title, r.status, r.confidentiality, r.generated_at, u.name generated_by_name, a.ref audit_ref
     FROM audit_reports r LEFT JOIN users u ON u.id=r.generated_by LEFT JOIN audits a ON a.id=r.audit_id
     WHERE ${clauses.join(" AND ")} ORDER BY r.generated_at DESC LIMIT 100`,
    params,
  );
}

export function reportRecord(user: SessionUser, scope: Scope, id: string) {
  const report = get<{
    id: string;
    report_ref: string;
    audit_id: string | null;
    kind: string;
    title: string;
    period_start: string | null;
    period_end: string | null;
    version: number;
    status: string;
    confidentiality: string;
    snapshot_json: string;
    generated_by: string | null;
    generated_at: string;
    approved_by: string | null;
    approved_at: string | null;
    generated_by_name: string | null;
    audit_ref: string | null;
    audit_outlet_id: string | null;
  }>(
    `SELECT r.*, u.name generated_by_name, a.ref audit_ref, a.outlet_id audit_outlet_id
     FROM audit_reports r LEFT JOIN users u ON u.id=r.generated_by LEFT JOIN audits a ON a.id=r.audit_id WHERE r.id=?`,
    [id],
  );
  if (!report) return null;
  if (
    user.role !== "head_audit" &&
    user.role !== "executive" &&
    user.role !== "audit_manager" &&
    report.generated_by !== user.id
  ) {
    if (report.audit_outlet_id) {
      const scopeSql = outletScopeSql(scope, "o");
      const allowed = get<{ id: string }>(
        `SELECT o.id FROM outlets o WHERE o.id=? AND ${scopeSql.sql}`,
        [report.audit_outlet_id, ...scopeSql.params],
      );
      if (!allowed) return null;
    } else {
      return null;
    }
  }
  return { ...report, snapshot: JSON.parse(report.snapshot_json) as ReportSnapshot };
}
