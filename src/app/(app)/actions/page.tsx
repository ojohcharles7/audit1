import Link from "next/link";
import { CheckCircle2, Search, TriangleAlert } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { parseFilters } from "@/lib/data/common";
import { actionStats, listActions } from "@/lib/data/actions";
import { outletsForScope, regions } from "@/lib/data/lookups";
import { ACTION_STATUSES } from "@/lib/constants";
import { formatDate, isOverdue } from "@/lib/format";
import { AlertBanner, EmptyState, KpiCard, PageHeader, Panel, Progress, SeverityBadge, StatusBadge } from "@/components/ui";

export const metadata = { title: "Corrective actions" };

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("actions.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const priority = typeof sp.priority === "string" ? sp.priority : "";
  const actions = listActions(scope, { ...filters, priority });
  const stats = actionStats(scope);

  return (
    <div>
      <PageHeader
        eyebrow="Corrective & preventive action"
        title="Corrective actions"
        description="Every finding has an accountable owner, deadline, progress record and independent verification before closure."
        actions={<Link href="/findings" className="btn-primary">Raise finding</Link>}
      />

      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total actions" value={stats.total} />
        <KpiCard label="Open" value={stats.open} tone="info" />
        <KpiCard label="Not started" value={stats.not_started} tone="warning" />
        <KpiCard label="Overdue" value={stats.overdue} tone="danger" icon={<TriangleAlert className="size-4" />} />
        <KpiCard label="Closed / verified" value={stats.closed + stats.verified} tone="success" icon={<CheckCircle2 className="size-4" />} />
      </section>

      <form method="get" className="card mb-5 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-44 flex-1"><label className="label">Search</label><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search className="size-3.5 text-slate-400" /><input name="q" defaultValue={filters.q} placeholder="Action, finding or outlet" className="w-full bg-transparent py-2 text-sm outline-none" /></div></div>
          <div className="min-w-40"><label className="label">Status</label><select name="status" defaultValue={filters.status} className="select"><option value="">All statuses</option>{ACTION_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}<option value="overdue">Overdue</option></select></div>
          <div className="min-w-32"><label className="label">Priority</label><select name="priority" defaultValue={priority} className="select"><option value="">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          <div className="min-w-36"><label className="label">Region</label><select name="region" defaultValue={filters.region} className="select"><option value="">All regions</option>{regions().map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div>
          <div className="min-w-44"><label className="label">Outlet</label><select name="outlet" defaultValue={filters.outlet} className="select"><option value="">All outlets</option>{outletsForScope(scope).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></div>
          <div className="flex gap-2"><button className="btn-primary" type="submit">Filter</button><Link href="/actions" className="btn-secondary">Reset</Link></div>
        </div>
      </form>

      <Panel title={`${actions.length} action${actions.length === 1 ? "" : "s"}`} description="Overdue items are ranked first.">
        <div className="table-wrap">
          <table className="table min-w-[1050px]">
            <thead><tr><th>Action</th><th>Finding</th><th>Outlet</th><th>Owner</th><th>Priority</th><th>Due</th><th>Status</th><th>Progress</th></tr></thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td className="max-w-72"><Link href={`/actions/${action.id}`} className="line-clamp-2 text-xs font-medium text-slate-800 hover:underline">{action.description}</Link><p className="text-[10px] font-mono text-slate-400">{action.ref}</p></td>
                  <td><Link href={`/findings/${action.finding_id}`} className="font-mono text-[10px] text-slate-600 hover:underline">{action.finding_ref}</Link><p className="line-clamp-1 text-[10px] text-slate-400">{action.finding_title}</p></td>
                  <td className="text-xs">{action.outlet_name}</td>
                  <td className="text-xs">{action.officer_name}</td>
                  <td><SeverityBadge severity={action.priority === "critical" ? "critical" : action.priority === "high" ? "high" : action.priority === "medium" ? "medium" : "low"} /></td>
                  <td className={`text-xs ${isOverdue(action.due_date, action.status) ? "font-semibold text-red-600" : ""}`}>{formatDate(action.due_date)}</td>
                  <td><StatusBadge status={isOverdue(action.due_date, action.status) ? "overdue" : action.status} /></td>
                  <td className="w-40"><Progress value={action.progress} /></td>
                </tr>
              ))}
              {actions.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-500"><EmptyState title="No corrective actions" description="Actions are created from audit findings." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
