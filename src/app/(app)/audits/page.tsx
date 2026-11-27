import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, Clock3, Plus, Search, ShieldAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { parseFilters } from "@/lib/data/common";
import { auditStats, listAudits } from "@/lib/data/audits";
import { auditors, outletsForScope, regions, states } from "@/lib/data/lookups";
import { AUDIT_CATEGORIES, AUDIT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { KpiCard, PageHeader, Panel, Score, StatusBadge } from "@/components/ui";

export const metadata = { title: "Outlet audits" };

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("audits.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const audits = listAudits(scope, filters);
  const stats = auditStats(scope);
  const created = sp.created === "1";

  return (
    <div>
      <PageHeader
        eyebrow="Audit execution"
        title="Outlet audits"
        description="All scheduled, in-progress, submitted and approved audits across the network."
        actions={<Link href="/planning" className="btn-primary"><Plus className="size-4" /> Schedule audit</Link>}
      />

      {created ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Audit scheduled successfully. Notifications were sent to the auditor and outlet manager.
        </div>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total audits" value={stats.total} icon={<ClipboardList className="size-4" />} />
        <KpiCard label="Scheduled" value={stats.scheduled} icon={<CalendarClock className="size-4" />} />
        <KpiCard label="In progress" value={stats.in_progress} icon={<Clock3 className="size-4" />} tone="info" />
        <KpiCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <KpiCard label="Overdue" value={stats.overdue} icon={<ShieldAlert className="size-4" />} tone="danger" />
      </section>

      <form method="get" className="card mb-5 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-44 flex-1">
            <label className="label">Search</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search className="size-3.5 text-slate-400" />
              <input name="q" defaultValue={filters.q} placeholder="Audit ref, outlet or title" className="w-full bg-transparent py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="min-w-36">
            <label className="label">Status</label>
            <select name="status" defaultValue={filters.status} className="select">
              <option value="">All statuses</option>
              {AUDIT_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">Region</label>
            <select name="region" defaultValue={filters.region} className="select">
              <option value="">All regions</option>
              {regions().map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">State</label>
            <select name="state" defaultValue={filters.state} className="select">
              <option value="">All states</option>
              {states().map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
            </select>
          </div>
          <div className="min-w-40">
            <label className="label">Outlet</label>
            <select name="outlet" defaultValue={filters.outlet} className="select">
              <option value="">All outlets</option>
              {outletsForScope(scope).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">Auditor</label>
            <select name="auditor" defaultValue={filters.auditor} className="select">
              <option value="">All auditors</option>
              {auditors().map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name}</option>)}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">Category</label>
            <select name="category" defaultValue={filters.category} className="select">
              <option value="">All categories</option>
              {AUDIT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.short}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">Filter</button>
            <Link href="/audits" className="btn-secondary">Reset</Link>
          </div>
        </div>
      </form>

      <Panel title={`${audits.length} audit${audits.length === 1 ? "" : "s"}`} description="Click an audit to view working papers, findings and approvals.">
        <div className="table-wrap">
          <table className="table min-w-[1050px]">
            <thead>
              <tr><th>Audit</th><th>Outlet</th><th>Auditor</th><th>Type</th><th>Planned</th><th>Due</th><th>Status</th><th>Score</th><th>Findings</th></tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td>
                    <Link href={`/audits/${audit.id}`} className="font-medium text-slate-800 hover:underline">{audit.title}</Link>
                    <p className="text-[10px] font-mono text-slate-400">{audit.ref}</p>
                  </td>
                  <td>
                    <Link href={`/outlets/${audit.outlet_id}`} className="text-xs text-slate-700 hover:underline">{audit.outlet_name}</Link>
                    <p className="text-[10px] text-slate-400">{audit.region_name}</p>
                  </td>
                  <td className="text-xs">{audit.auditor_name}</td>
                  <td className="text-xs capitalize">{audit.audit_type.replace("_", " ")}</td>
                  <td className="text-xs">{formatDate(audit.planned_date)}</td>
                  <td className={`text-xs ${new Date(audit.due_date) < new Date() && !["approved","closed"].includes(audit.status) ? "font-semibold text-red-600" : ""}`}>{formatDate(audit.due_date)}</td>
                  <td><StatusBadge status={audit.status} /></td>
                  <td><Score value={audit.score} /></td>
                  <td className="text-xs tabular-nums">{audit.open_findings}</td>
                </tr>
              ))}
              {audits.length === 0 ? <tr><td colSpan={9} className="py-8 text-center text-sm text-slate-500">No audits match the filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
