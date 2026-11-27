import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Gauge,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Store,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { AUDIT_CATEGORIES, categoryLabel, DEMO_PASSWORD } from "@/lib/constants";
import { formatDate, formatMoney, percent, titleCase } from "@/lib/format";
import { parseFilters } from "@/lib/data/common";
import { auditors, outletsForScope, regions, states } from "@/lib/data/lookups";
import { dashboardData, riskMatrixCounts } from "@/lib/data/dashboard";
import { KpiCard, Panel, StatusBadge, SeverityBadge, AlertBanner, Score, Progress } from "@/components/ui";
import {
  ActionCompletionChart,
  CategoryBarChart,
  DiscrepancyTrendChart,
  MonthlyPerformanceChart,
  RegionScoresChart,
  RiskHeatMap,
  SeverityChart,
} from "@/components/charts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("dashboard.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const year = new Date().getFullYear();
  const filters = parseFilters({
    ...sp,
    from: (sp.from as string) || `${year}-01-01`,
    to: (sp.to as string) || `${year}-12-31`,
  });
  const data = dashboardData(scope, filters);
  const matrix = riskMatrixCounts(scope);
  const regionOptions = regions();
  const stateOptions = states();
  const outletOptions = outletsForScope(scope);
  const auditorOptions = auditors();
  const denied = typeof sp.denied === "string" ? sp.denied : null;
  const orgName = "Crunchies Fried Chicken";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Head of Internal Audit · Command centre</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Organisation assurance overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            {orgName} · {data.stats.totalOutlets} outlets · live audit, risk and remediation intelligence
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/planning" className="btn-secondary">
            <CalendarClock className="size-4" /> Audit plan
          </Link>
          <Link href="/reports" className="btn-dark">
            <FileWarning className="size-4" /> Generate report
          </Link>
        </div>
      </div>

      {denied ? (
        <AlertBanner tone="amber" title="Access restricted">
          Your role does not include <span className="font-mono">{denied}</span>. Ask the Head of Internal Audit if you
          need additional access.
        </AlertBanner>
      ) : null}

      <form method="get" className="card p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-32">
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={filters.from} className="input" />
          </div>
          <div className="min-w-32">
            <label className="label">To</label>
            <input type="date" name="to" defaultValue={filters.to} className="input" />
          </div>
          <div className="min-w-36">
            <label className="label">Region</label>
            <select name="region" defaultValue={filters.region} className="select">
              <option value="">All regions</option>
              {regionOptions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">State</label>
            <select name="state" defaultValue={filters.state} className="select">
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-44">
            <label className="label">Outlet</label>
            <select name="outlet" defaultValue={filters.outlet} className="select">
              <option value="">All outlets</option>
              {outletOptions.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40">
            <label className="label">Auditor</label>
            <select name="auditor" defaultValue={filters.auditor} className="select">
              <option value="">All auditors</option>
              {auditorOptions.map((auditor) => (
                <option key={auditor.id} value={auditor.id}>
                  {auditor.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-40">
            <label className="label">Category</label>
            <select name="category" defaultValue={filters.category} className="select">
              <option value="">All categories</option>
              {AUDIT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.short}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Apply filters
            </button>
            <Link href="/dashboard" className="btn-secondary">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total outlets" value={data.stats.totalOutlets} icon={<Store className="size-4" />} href="/outlets" hint="Active outlet network" />
        <KpiCard label="Audits conducted" value={data.stats.conducted} icon={<ClipboardCheck className="size-4" />} href="/audits" tone="info" />
        <KpiCard label="Audits scheduled" value={data.stats.scheduled} icon={<CalendarClock className="size-4" />} href="/planning" />
        <KpiCard label="In progress" value={data.stats.inProgress} icon={<Clock3 className="size-4" />} tone="info" href="/audits?status=in_progress" />
        <KpiCard label="Completed" value={data.stats.completed} icon={<CheckCircle2 className="size-4" />} tone="success" href="/audits?status=approved" />
        <KpiCard label="Overdue audits" value={data.stats.overdue} icon={<AlertTriangle className="size-4" />} tone="danger" href="/audits?status=overdue" />
        <KpiCard label="Audited this month" value={data.stats.auditedThisMonth} icon={<CalendarClock className="size-4" />} tone="success" hint="Distinct outlets" />
        <KpiCard label="High-risk outlets" value={data.stats.highRiskOutlets} icon={<MapPinned className="size-4" />} tone="danger" href="/outlets?risk=high" />
        <KpiCard label="Critical findings" value={data.stats.openCritical} icon={<FileWarning className="size-4" />} tone="danger" href="/findings?severity=critical" />
        <KpiCard label="Financial exposure" value={formatMoney(data.stats.financialExposure, true)} icon={<Banknote className="size-4" />} tone="warning" hint={`${data.stats.discrepancyCount} open findings with impact`} href="/findings?category=financial" />
        <KpiCard label="Open fraud cases" value={data.stats.openFraud} icon={<LockKeyhole className="size-4" />} tone="danger" href={can(user, "fraud.view") ? "/fraud" : "/dashboard"} />
        <KpiCard label="Outstanding actions" value={data.stats.outstandingActions} icon={<Clock3 className="size-4" />} tone="warning" href="/actions" />
        <KpiCard label="Average audit score" value={percent(data.stats.avgScore, 1)} icon={<Gauge className="size-4" />} tone="info" hint="Approved audits in period" />
        <KpiCard label="Control compliance" value={percent(data.stats.controlRate, 1)} icon={<ShieldCheck className="size-4" />} tone="success" href="/controls" hint="Weighted control effectiveness" />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          title="Monthly audit performance"
          description="Completed audits, findings raised and average outlet score over the last 12 months."
          action={<span className="badge bg-slate-50 text-slate-500 ring-slate-200">Trailing 12 months</span>}
        >
          <MonthlyPerformanceChart data={data.monthly} />
        </Panel>
        <Panel className="xl:col-span-4" title="Findings by severity" description="Open findings, excluding resolved and rejected.">
          <SeverityChart data={data.severity} />
        </Panel>

        <Panel className="xl:col-span-6" title="Audit scores by region" description="Average approved audit score in the selected period.">
          <RegionScoresChart data={data.regions} />
        </Panel>
        <Panel className="xl:col-span-6" title="Findings by department" description="Open findings grouped by audit category.">
          <CategoryBarChart
            data={data.categories.map((row) => ({ name: categoryLabel(row.name).replace(" & ", " "), value: row.value }))}
          />
        </Panel>

        <Panel className="xl:col-span-7" title="Financial discrepancies over time" description="Open financial impact from findings, by month raised.">
          <DiscrepancyTrendChart data={data.discrepancyTrend} />
        </Panel>
        <Panel className="xl:col-span-5" title="Corrective action completion" description="Status of actions linked to findings in the period.">
          <ActionCompletionChart data={data.actionCompletion} />
          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            <span>Completion rate</span>
            <span className="font-semibold text-slate-900">
              {(() => {
                const total = data.actionCompletion.reduce((sum, item) => sum + item.value, 0);
                const closed = data.actionCompletion.find((item) => item.name === "Closed")?.value ?? 0;
                return total ? `${Math.round((closed / total) * 100)}%` : "—";
              })()}
            </span>
          </div>
        </Panel>

        <Panel
          className="xl:col-span-7"
          title="Outlet risk ranking"
          description="Highest-risk outlets by critical findings, exposure and latest audit score."
          action={<Link href="/rankings" className="text-xs font-semibold text-slate-500 hover:text-slate-900">Full rankings →</Link>}
        >
          <div className="table-wrap">
            <table className="table min-w-[520px]">
              <thead>
                <tr>
                  <th>Outlet</th>
                  <th>Risk</th>
                  <th>Score</th>
                  <th>Open</th>
                  <th>Exposure</th>
                </tr>
              </thead>
              <tbody>
                {data.topRiskOutlets.map((outlet) => (
                  <tr key={outlet.id}>
                    <td>
                      <Link href={`/outlets/${outlet.id}`} className="font-medium text-slate-800 hover:underline">
                        {outlet.name}
                      </Link>
                      <p className="text-[10px] text-slate-400">{outlet.code}</p>
                    </td>
                    <td>
                      <span className={`badge ${outlet.risk_rating === "critical" ? "bg-red-600 text-white ring-red-600" : outlet.risk_rating === "high" ? "bg-orange-500 text-white ring-orange-500" : outlet.risk_rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>
                        {titleCase(outlet.risk_rating)}
                      </span>
                    </td>
                    <td>
                      <Score value={outlet.last_audit_score} />
                    </td>
                    <td className="tabular-nums">
                      {outlet.open_findings}
                      {outlet.critical_findings > 0 ? <span className="ml-1 text-[10px] font-semibold text-red-600">({outlet.critical_findings} crit)</span> : null}
                    </td>
                    <td className="tabular-nums">{formatMoney(outlet.exposure, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="xl:col-span-5" title="Risk heat map" description="Residual risk distribution on the 5 × 5 matrix.">
          <RiskHeatMap counts={matrix} thresholds={data.riskThresholds} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Critical", data.severity.find((s) => s.name === "critical")?.value ?? 0],
              ["Open actions", data.stats.outstandingActions],
              ["Fraud cases", data.stats.openFraud],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 px-2 py-2">
                <p className="text-base font-semibold text-slate-900">{value}</p>
                <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Critical findings"
          description="Open critical exceptions requiring executive visibility."
          action={<Link href="/findings?severity=critical" className="text-xs font-semibold text-slate-500 hover:text-slate-900">View all →</Link>}
        >
          {data.criticalFindings.length ? (
            <ul className="divide-y divide-slate-100">
              {data.criticalFindings.map((finding) => (
                <li key={finding.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/findings/${finding.id}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:underline">
                        {finding.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="font-mono">{finding.ref}</span> · {finding.outlet_name} · Target {formatDate(finding.target_date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <SeverityBadge severity={finding.severity} />
                      <p className="mt-1 text-[10px] font-medium tabular-nums text-red-600">{formatMoney(finding.financial_impact_kobo, true)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No open critical findings in the selected period.</p>
          )}
        </Panel>

        <Panel
          title="Recent audits"
          description="Latest fieldwork across the network."
          action={<Link href="/audits" className="text-xs font-semibold text-slate-500 hover:text-slate-900">View all →</Link>}
        >
          <ul className="divide-y divide-slate-100">
            {data.recentAudits.map((audit) => (
              <li key={audit.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/audits/${audit.id}`} className="block truncate text-sm font-medium text-slate-800 hover:underline">
                      {audit.title}
                    </Link>
                    <p className="mt-1 text-[10px] text-slate-400">
                      <span className="font-mono">{audit.ref}</span> · {audit.auditor_name} · due {formatDate(audit.due_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={audit.status} />
                    <Score value={audit.score} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Repeated audit issues" description="Categories with recurring findings across outlets." className="xl:col-span-2">
          {data.repeated.length ? (
            <div className="space-y-3">
              {data.repeated.map((row) => {
                const max = Math.max(...data.repeated.map((r) => r.value), 1);
                return (
                  <div key={row.name}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{categoryLabel(row.name)}</span>
                      <span className="font-semibold text-slate-900">{row.value}</span>
                    </div>
                    <Progress value={(row.value / max) * 100} tone="red" />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No repeated issues have been identified.</p>
          )}
        </Panel>
        <Panel title="Critical escalations" description="Auto-escalated to executive management.">
          <ul className="space-y-3">
            {data.escalations.map((item) => (
              <li key={item.id} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                <p className="line-clamp-2 text-[11px] font-medium text-slate-800">{item.reason}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {item.outlet_name} · {formatDate(item.created_at)}
                </p>
                <Link href={`/findings/${item.finding_id}`} className="mt-1 inline-block text-[10px] font-semibold text-red-700 hover:underline">
                  Review finding →
                </Link>
              </li>
            ))}
            {data.escalations.length === 0 ? <li className="text-sm text-slate-500">No escalations recorded.</li> : null}
          </ul>
        </Panel>
      </section>

      <p className="pb-2 text-center text-[10px] text-slate-400">
        Demo environment · Password for all demo accounts: <span className="font-semibold">{DEMO_PASSWORD}</span> · Data is
        fictional.
      </p>
    </div>
  );
}
