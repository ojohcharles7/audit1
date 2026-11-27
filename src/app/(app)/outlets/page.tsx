import Link from "next/link";
import { Building2, MapPin, Search, ShieldAlert, Store, Trophy } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { parseFilters } from "@/lib/data/common";
import { listOutlets } from "@/lib/data/outlets";
import { regions, states } from "@/lib/data/lookups";
import { formatDate, percent, titleCase } from "@/lib/format";
import { KpiCard, PageHeader, Panel, Score } from "@/components/ui";

export const metadata = { title: "Outlet management" };

export default async function OutletsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("outlets.view");
  const scope = await getScope(user);
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const risk = typeof sp.risk === "string" ? sp.risk : "";
  const outlets = await listOutlets(scope, { ...filters, risk });
  const all = await listOutlets(scope, {});
  const highRisk = all.filter((outlet) => ["high", "critical"].includes(outlet.risk_rating)).length;
  const avg = all.filter((o) => o.last_audit_score != null).reduce((sum, o) => sum + (o.last_audit_score ?? 0), 0) / Math.max(1, all.filter((o) => o.last_audit_score != null).length);
  const openFindings = all.reduce((sum, outlet) => sum + (outlet.open_findings ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Network assurance"
        title="Outlet management"
        description="Profiles, audit history, risk posture and compliance status for every outlet in the network."
        actions={
          <>
            <Link href="/rankings" className="btn-secondary">
              <Trophy className="size-4" /> Performance rankings
            </Link>
            <Link href="/planning" className="btn-primary">
              Schedule audit
            </Link>
          </>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Outlets in scope" value={all.length} icon={<Store className="size-4" />} />
        <KpiCard label="High-risk outlets" value={highRisk} icon={<ShieldAlert className="size-4" />} tone="danger" />
        <KpiCard label="Open findings" value={openFindings} icon={<MapPin className="size-4" />} tone="warning" />
        <KpiCard label="Average latest score" value={percent(avg, 1)} icon={<Building2 className="size-4" />} tone="info" />
      </section>

      <form method="get" className="card mb-5 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
          <div className="min-w-44 flex-1">
            <label className="label">Search outlet</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search className="size-3.5 text-slate-400" />
              <input name="q" defaultValue={filters.q} placeholder="Name or outlet code" className="w-full bg-transparent py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="min-w-40">
            <label className="label">Region</label>
            <select name="region" defaultValue={filters.region} className="select">
              <option value="">All regions</option>
              {(await regions()).map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">State</label>
            <select name="state" defaultValue={filters.state} className="select">
              <option value="">All states</option>
              {(await states()).map((state) => (
                <option key={state.id} value={state.id}>{state.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-36">
            <label className="label">Risk</label>
            <select name="risk" defaultValue={risk} className="select">
              <option value="">All ratings</option>
              <option value="high">High & critical</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" type="submit">Filter</button>
            <Link href="/outlets" className="btn-secondary">Reset</Link>
          </div>
        </div>
      </form>

      <Panel title={`${outlets.length} outlet${outlets.length === 1 ? "" : "s"}`} description="Latest approved audit score and open exception count.">
        <div className="table-wrap">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Outlet</th>
                <th>Location</th>
                <th>Manager</th>
                <th>Risk</th>
                <th>Latest score</th>
                <th>Open findings</th>
                <th>Audits</th>
                <th>Last audit</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map((outlet) => (
                <tr key={outlet.id}>
                  <td>
                    <Link href={`/outlets/${outlet.id}`} className="font-medium text-slate-800 hover:underline">{outlet.name}</Link>
                    <p className="text-[10px] font-mono text-slate-400">{outlet.code}</p>
                  </td>
                  <td>
                    <p className="text-xs">{outlet.state_name}</p>
                    <p className="text-[10px] text-slate-400">{outlet.region_name}</p>
                  </td>
                  <td className="text-xs">{outlet.manager_name ?? "—"}</td>
                  <td>
                    <span className={`badge ${outlet.risk_rating === "critical" ? "bg-red-600 text-white ring-red-600" : outlet.risk_rating === "high" ? "bg-orange-500 text-white ring-orange-500" : outlet.risk_rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>
                      {titleCase(outlet.risk_rating)}
                    </span>
                  </td>
                  <td><Score value={outlet.last_audit_score} /></td>
                  <td className="tabular-nums">{outlet.open_findings}</td>
                  <td className="tabular-nums">{outlet.audit_count}</td>
                  <td className="text-xs text-slate-500">{formatDate(outlet.last_audit_at)}</td>
                </tr>
              ))}
              {outlets.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-500">No outlets match the selected filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
