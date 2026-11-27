import Link from "next/link";
import { DATE_PLUS_90 } from "@/lib/defaults";
import { Plus, ShieldAlert, ShieldCheck, Target } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";
import { outletsForScope, staffList } from "@/lib/data/lookups";
import { RISK_CATEGORIES, RISK_EFFECTIVENESS } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { AlertBanner, KpiCard, PageHeader, Panel } from "@/components/ui";
import { RiskHeatMap } from "@/components/charts";
import { SubmitButton } from "@/components/submit-button";
import { createRiskAction } from "./actions";

export const metadata = { title: "Risk register" };

export default async function RisksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("risks.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : "";
  const rating = typeof sp.rating === "string" ? sp.rating : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const scopeSql = outletScopeSql(scope, "o");
  const clauses = ["(r.outlet_id IS NULL OR " + scopeSql.sql + ")"];
  const params: unknown[] = [...scopeSql.params];
  if (category) { clauses.push("r.category=?"); params.push(category); }
  if (rating) { clauses.push("r.rating=?"); params.push(rating); }
  if (q) { clauses.push("(r.title LIKE ? OR r.ref LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const risks = all<{ id: string; ref: string; title: string; category: string; likelihood: number; impact: number; inherent_score: number; residual_score: number; rating: string; status: string; owner_name: string | null; outlet_name: string | null; review_date: string | null; control_effectiveness: string }>(
    `SELECT r.*, u.name owner_name, o.name outlet_name FROM risks r LEFT JOIN users u ON u.id=r.owner_id LEFT JOIN outlets o ON o.id=r.outlet_id WHERE ${clauses.join(" AND ")} ORDER BY r.residual_score DESC, r.created_at DESC`,
    params,
  );
  const settings = getSetting<{ critical: number; high: number; medium: number }>("risk");
  const matrix: Record<string, number> = {};
  for (const risk of risks) matrix[`${risk.likelihood}-${risk.impact}`] = (matrix[`${risk.likelihood}-${risk.impact}`] ?? 0) + 1;
  const manual = can(user, "risks.manage");

  return (
    <div>
      <PageHeader eyebrow="Enterprise risk management" title="Risk register" description="Identify, assess, mitigate and monitor financial, operational, fraud, compliance, IT and people risks on a 5 × 5 matrix." actions={manual ? <a href="#new-risk" className="btn-primary"><Plus className="size-4" /> New risk</a> : null} />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Risks in register" value={risks.length} icon={<Target className="size-4" />} />
        <KpiCard label="Critical" value={risks.filter((r) => r.rating === "critical").length} tone="danger" icon={<ShieldAlert className="size-4" />} />
        <KpiCard label="High" value={risks.filter((r) => r.rating === "high").length} tone="warning" />
        <KpiCard label="Open" value={risks.filter((r) => r.status !== "closed").length} tone="info" icon={<ShieldCheck className="size-4" />} />
      </section>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title="Risk heat map" description="Residual risk positions across the network."><RiskHeatMap counts={matrix} thresholds={settings} /><div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-semibold">{risks.length}</p><p className="text-[9px] uppercase text-slate-400">Assessed</p></div><div className="rounded-lg bg-red-50 p-2"><p className="text-lg font-semibold text-red-700">{risks.filter((r) => r.rating === "critical").length}</p><p className="text-[9px] uppercase text-red-500">Critical</p></div></div></Panel>
        <Panel title={`${risks.length} risk${risks.length === 1 ? "" : "s"}`} description="Click a risk to review controls and mitigation.">
          <form method="get" className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search risks" className="input max-w-56" /><select name="category" defaultValue={category} className="select max-w-40"><option value="">All categories</option>{RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select><select name="rating" defaultValue={rating} className="select max-w-32"><option value="">All ratings</option>{["critical","high","medium","low"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select><button className="btn-secondary" type="submit">Filter</button></form>
          <div className="table-wrap"><table className="table min-w-[760px]"><thead><tr><th>Risk</th><th>Category</th><th>L×I</th><th>Residual</th><th>Rating</th><th>Owner</th><th>Review</th></tr></thead><tbody>
            {risks.map((risk) => (<tr key={risk.id}><td><Link href={`/risks/${risk.id}`} className="text-xs font-medium text-slate-800 hover:underline">{risk.title}</Link><p className="text-[10px] font-mono text-slate-400">{risk.ref} {risk.outlet_name ? `· ${risk.outlet_name}` : "· Enterprise"}</p></td><td className="text-xs">{risk.category}</td><td className="text-xs">{risk.likelihood}×{risk.impact} = {risk.inherent_score}</td><td className="text-xs font-semibold">{risk.residual_score}</td><td><span className={`badge ${risk.rating === "critical" ? "bg-red-600 text-white ring-red-600" : risk.rating === "high" ? "bg-orange-500 text-white ring-orange-500" : risk.rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>{titleCase(risk.rating)}</span></td><td className="text-xs">{risk.owner_name ?? "—"}</td><td className="text-xs">{formatDate(risk.review_date)}</td></tr>))}
            {!risks.length ? <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No risks match the filters.</td></tr> : null}
          </tbody></table></div>
        </Panel>
      </div>
      {manual ? (
        <div className="mt-4" id="new-risk">
          <Panel title="Add a risk" description="Likelihood and impact are scored 1–5; residual risk adjusts for control effectiveness.">
            <form action={createRiskAction} className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Risk title</label><input name="title" required className="input" /></div>
              <div><label className="label">Category</label><select name="category" className="select">{RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="label">Outlet (optional)</label><select name="outletId" className="select"><option value="">Enterprise-wide</option>{outletsForScope(scope).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
              <div><label className="label">Risk owner</label><select name="ownerId" className="select"><option value="">Unassigned</option>{staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">Likelihood (1–5)</label><input name="likelihood" type="number" min="1" max="5" defaultValue="3" className="input" /></div>
              <div><label className="label">Impact (1–5)</label><input name="impact" type="number" min="1" max="5" defaultValue="4" className="input" /></div>
              <div><label className="label">Control effectiveness</label><select name="effectiveness" className="select">{RISK_EFFECTIVENESS.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}</select></div>
              <div><label className="label">Review date</label><input name="reviewDate" type="date" className="input" defaultValue={DATE_PLUS_90} /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" required className="textarea" /></div>
              <div><label className="label">Existing controls</label><input name="existingControls" className="input" /></div>
              <div><label className="label">Mitigation strategy</label><input name="mitigation" className="input" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary">Add risk</SubmitButton></div>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
