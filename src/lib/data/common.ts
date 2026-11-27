import type { Scope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";

export type ListFilters = {
  from: string;
  to: string;
  region: string;
  state: string;
  outlet: string;
  auditor: string;
  category: string;
  severity: string;
  status: string;
  q: string;
  tab: string;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseFilters(searchParams: RawSearchParams): ListFilters {
  const get = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : "";
  };
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), 0, 1);
  return {
    from: get("from") || defaultFrom.toISOString().slice(0, 10),
    to: get("to") || now.toISOString().slice(0, 10),
    region: get("region"),
    state: get("state"),
    outlet: get("outlet"),
    auditor: get("auditor"),
    category: get("category"),
    severity: get("severity"),
    status: get("status"),
    q: get("q"),
    tab: get("tab") || "overview",
    page: Math.max(1, Number(get("page")) || 1),
  };
}

export function whereAudits(scope: Scope, f: Partial<ListFilters>, auditAlias = "a", outletAlias = "o") {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  const scopeSql = outletScopeSql(scope, outletAlias);
  clauses.push(scopeSql.sql);
  params.push(...scopeSql.params);
  if (f.region) {
    clauses.push(`${outletAlias}.region_id = ?`);
    params.push(f.region);
  }
  if (f.state) {
    clauses.push(`${outletAlias}.state_id = ?`);
    params.push(f.state);
  }
  if (f.outlet) {
    clauses.push(`${auditAlias}.outlet_id = ?`);
    params.push(f.outlet);
  }
  if (f.auditor) {
    clauses.push(`${auditAlias}.auditor_id = ?`);
    params.push(f.auditor);
  }
  if (f.category) {
    clauses.push(`${auditAlias}.category = ?`);
    params.push(f.category);
  }
  if (f.status) {
    if (f.status === "overdue") {
      clauses.push(`${auditAlias}.status = 'overdue'`);
    } else {
      clauses.push(`${auditAlias}.status = ?`);
      params.push(f.status);
    }
  }
  if (f.from) {
    clauses.push(`${auditAlias}.planned_date >= ?`);
    params.push(f.from);
  }
  if (f.to) {
    clauses.push(`${auditAlias}.planned_date <= ?`);
    params.push(f.to);
  }
  if (f.q) {
    clauses.push(`(${auditAlias}.ref ILIKE ? OR ${outletAlias}.name ILIKE ? OR ${auditAlias}.title ILIKE ?)`);
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  return { sql: clauses.join(" AND "), params };
}

export function whereFindings(scope: Scope, f: Partial<ListFilters>, findingAlias = "f", outletAlias = "o") {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  const scopeSql = outletScopeSql(scope, outletAlias);
  clauses.push(scopeSql.sql);
  params.push(...scopeSql.params);
  if (f.region) {
    clauses.push(`${outletAlias}.region_id = ?`);
    params.push(f.region);
  }
  if (f.state) {
    clauses.push(`${outletAlias}.state_id = ?`);
    params.push(f.state);
  }
  if (f.outlet) {
    clauses.push(`${findingAlias}.outlet_id = ?`);
    params.push(f.outlet);
  }
  if (f.category) {
    clauses.push(`${findingAlias}.category = ?`);
    params.push(f.category);
  }
  if (f.severity) {
    clauses.push(`${findingAlias}.severity = ?`);
    params.push(f.severity);
  }
  if (f.status) {
    if (f.status === "overdue") {
      clauses.push(`(${findingAlias}.status = 'overdue' OR (${findingAlias}.status NOT IN ('resolved','rejected') AND ${findingAlias}.target_date < to_char(CURRENT_DATE,'YYYY-MM-DD')))`);
    } else {
      clauses.push(`${findingAlias}.status = ?`);
      params.push(f.status);
    }
  }
  if (f.from) {
    clauses.push(`${findingAlias}.created_at >= ?`);
    params.push(`${f.from}T00:00:00.000Z`);
  }
  if (f.to) {
    clauses.push(`${findingAlias}.created_at <= ?`);
    params.push(`${f.to}T23:59:59.999Z`);
  }
  if (f.q) {
    clauses.push(`(${findingAlias}.ref ILIKE ? OR ${findingAlias}.title ILIKE ? OR ${outletAlias}.name ILIKE ?)`);
    const like = `%${f.q}%`;
    params.push(like, like, like);
  }
  return { sql: clauses.join(" AND "), params };
}

export function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
