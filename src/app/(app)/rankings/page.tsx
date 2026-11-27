import Link from "next/link";
import { ArrowLeft, Repeat2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { outletRankings } from "@/lib/data/outlets";
import { formatMoney, percent, titleCase } from "@/lib/format";
import { KpiCard, PageHeader, Panel, Progress, Score } from "@/components/ui";

export const metadata = { title: "Outlet performance rankings" };

export default async function RankingsPage() {
  const user = await requirePermission("rankings.view");
  const scope = await getScope(user);
  const rows = await outletRankings(scope);
  const best = rows.slice(0, 4);
  const worst = [...rows].reverse().slice(0, 4);
  const improved = [...rows].sort((a, b) => b.improvement - a.improvement).slice(0, 4);
  const repeat = [...rows].sort((a, b) => b.repeated_findings - a.repeated_findings).slice(0, 4);
  const avgComposite = rows.length ? rows.reduce((sum, row) => sum + row.composite, 0) / rows.length : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Outlet comparison"
        title="Performance rankings"
        description="Composite assurance index combining audit compliance, corrective action performance, critical findings, financial exposure and repeated irregularities."
        actions={<Link href="/outlets" className="btn-secondary"><ArrowLeft className="size-4" /> Outlet management</Link>}
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Average assurance index" value={percent(avgComposite, 1)} icon={<Trophy className="size-4" />} tone="info" />
        <KpiCard label="Outlets ranked" value={rows.length} />
        <KpiCard label="Highest exposure" value={formatMoney(Math.max(...rows.map((r) => r.exposure), 0), true)} tone="danger" />
        <KpiCard label="Repeat issues" value={rows.reduce((sum, row) => sum + row.repeated_findings, 0)} tone="warning" />
      </section>

      <div className="mb-4 grid gap-4 xl:grid-cols-4">
        {[
          { title: "Best performing", rows: best, icon: <Trophy className="size-4 text-emerald-600" />, value: (r: typeof rows[number]) => percent(r.composite, 1) },
          { title: "Lowest performing", rows: worst, icon: <TrendingDown className="size-4 text-red-600" />, value: (r: typeof rows[number]) => percent(r.composite, 1) },
          { title: "Most improved", rows: improved, icon: <TrendingUp className="size-4 text-blue-600" />, value: (r: typeof rows[number]) => `${r.improvement > 0 ? "+" : ""}${r.improvement} pts` },
          { title: "Repeated irregularities", rows: repeat, icon: <Repeat2 className="size-4 text-amber-600" />, value: (r: typeof rows[number]) => `${r.repeated_findings} repeated` },
        ].map((group) => (
          <Panel key={group.title} title={<span className="flex items-center gap-2">{group.icon}{group.title}</span>} bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              {group.rows.map((row, index) => (
                <li key={row.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/outlets/${row.id}`} className="block truncate text-xs font-medium text-slate-800 hover:underline">{row.name}</Link>
                    <p className="text-[10px] text-slate-400">{row.region_name}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-700">{group.value(row)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel title="Full network ranking" description="Assurance index: 40% audit score, 20% corrective action completion, 40% risk and exposure adjustments.">
        <div className="table-wrap">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th>Rank</th><th>Outlet</th><th>Risk</th><th>Latest score</th><th>Change</th><th>Assurance index</th><th>Open findings</th><th>Critical</th><th>Actions</th><th>Exposure</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="text-xs font-semibold text-slate-400">#{index + 1}</td>
                  <td>
                    <Link href={`/outlets/${row.id}`} className="font-medium text-slate-800 hover:underline">{row.name}</Link>
                    <p className="text-[10px] font-mono text-slate-400">{row.code} · {row.region_name}</p>
                  </td>
                  <td>
                    <span className={`badge ${row.risk_rating === "critical" ? "bg-red-600 text-white ring-red-600" : row.risk_rating === "high" ? "bg-orange-500 text-white ring-orange-500" : row.risk_rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>
                      {titleCase(row.risk_rating)}
                    </span>
                  </td>
                  <td><Score value={row.last_audit_score} /></td>
                  <td className={`text-xs font-medium ${row.improvement > 0 ? "text-emerald-600" : row.improvement < 0 ? "text-red-600" : "text-slate-400"}`}>
                    {row.improvement > 0 ? "+" : ""}{row.improvement}
                  </td>
                  <td className="w-40"><Progress value={row.composite} tone={row.composite >= 70 ? "green" : row.composite >= 50 ? "amber" : "red"} /></td>
                  <td className="tabular-nums">{row.open_findings}</td>
                  <td className="tabular-nums text-red-600">{row.critical_findings}</td>
                  <td className="text-xs tabular-nums">{row.actions_closed}/{row.actions_total}</td>
                  <td className="text-xs tabular-nums">{formatMoney(row.exposure, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
