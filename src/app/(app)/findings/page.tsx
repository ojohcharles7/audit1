import Link from "next/link";
import { DATE_PLUS_30 } from "@/lib/defaults";
import { AlertTriangle, Banknote, FileWarning, Plus, Search } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { parseFilters } from "@/lib/data/common";
import { findingOptions, findingStats, listFindings } from "@/lib/data/findings";
import { allAuditsForSelect, outletsForScope, staffList } from "@/lib/data/lookups";
import { AUDIT_CATEGORIES, SEVERITIES, FINDING_STATUSES, categoryLabel } from "@/lib/constants";
import { formatDate, formatMoney, isOverdue, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel, SeverityBadge, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createFindingAction } from "./actions";

export const metadata = { title: "Audit findings" };

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("findings.view");
  const scope = await getScope(user);
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const findings = await listFindings(scope, filters);
  const stats = await findingStats(scope);
  const outletOptions = await outletsForScope(scope);
  const auditOptions = await allAuditsForSelect(scope);
  const staff = await staffList();

  return (
    <div>
      <PageHeader
        eyebrow="Exception management"
        title="Audit findings"
        description="Central register of control exceptions, financial irregularities and observations with full remediation history."
        actions={can(user, "findings.create") ? <a href="#new-finding" className="btn-primary"><Plus className="size-4" /> New finding</a> : null}
      />

      {typeof sp.error === "string" ? <div className="mb-4"><AlertBanner tone="red" title={sp.error} /></div> : null}
      {sp.created === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Finding created">Management has been notified and a corrective action was assigned.</AlertBanner></div> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total findings" value={stats.total} icon={<FileWarning className="size-4" />} />
        <KpiCard label="Open" value={stats.open} icon={<AlertTriangle className="size-4" />} tone="warning" />
        <KpiCard label="Critical open" value={stats.critical} icon={<AlertTriangle className="size-4" />} tone="danger" />
        <KpiCard label="Overdue" value={stats.overdue} icon={<AlertTriangle className="size-4" />} tone="danger" />
        <KpiCard label="Financial exposure" value={formatMoney(stats.exposure, true)} icon={<Banknote className="size-4" />} tone="warning" />
      </section>

      <form method="get" className="card mb-5 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-44 flex-1"><label className="label">Search</label><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search className="size-3.5 text-slate-400" /><input name="q" defaultValue={filters.q} placeholder="Reference, title or outlet" className="w-full bg-transparent py-2 text-sm outline-none" /></div></div>
          <div className="min-w-36"><label className="label">Severity</label><select name="severity" defaultValue={filters.severity} className="select"><option value="">All severities</option>{SEVERITIES.map((severity) => <option key={severity.id} value={severity.id}>{severity.label}</option>)}</select></div>
          <div className="min-w-44"><label className="label">Status</label><select name="status" defaultValue={filters.status} className="select"><option value="">All statuses</option>{FINDING_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}</select></div>
          <div className="min-w-40"><label className="label">Category</label><select name="category" defaultValue={filters.category} className="select"><option value="">All categories</option>{AUDIT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.short}</option>)}</select></div>
          <div className="min-w-44"><label className="label">Outlet</label><select name="outlet" defaultValue={filters.outlet} className="select"><option value="">All outlets</option>{outletOptions.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></div>
          <div className="flex gap-2"><button className="btn-primary" type="submit">Filter</button><Link href="/findings" className="btn-secondary">Reset</Link></div>
        </div>
      </form>

      <Panel title={`${findings.length} finding${findings.length === 1 ? "" : "s"}`} description="Severity, status and financial impact are updated as remediation progresses.">
        <div className="table-wrap">
          <table className="table min-w-[1050px]">
            <thead><tr><th>Reference</th><th>Finding</th><th>Outlet</th><th>Category</th><th>Severity</th><th>Status</th><th>Owner</th><th>Target</th><th>Exposure</th><th>Actions</th></tr></thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.id}>
                  <td><Link href={`/findings/${finding.id}`} className="font-mono text-[11px] text-slate-600 hover:underline">{finding.ref}</Link></td>
                  <td className="max-w-72"><Link href={`/findings/${finding.id}`} className="line-clamp-2 text-xs font-medium text-slate-800 hover:underline">{finding.title}</Link><p className="text-[10px] text-slate-400">{finding.audit_ref ? `Audit ${finding.audit_ref}` : "Continuous review"}</p></td>
                  <td className="text-xs">{finding.outlet_name}<p className="text-[10px] text-slate-400">{finding.region_name}</p></td>
                  <td className="text-xs">{categoryLabel(finding.category)}</td>
                  <td><SeverityBadge severity={finding.severity} /></td>
                  <td><StatusBadge status={isOverdue(finding.target_date, finding.status) ? "overdue" : finding.status} /></td>
                  <td className="text-xs">{finding.responsible_name ?? "—"}</td>
                  <td className={`text-xs ${isOverdue(finding.target_date, finding.status) ? "font-semibold text-red-600" : ""}`}>{formatDate(finding.target_date)}</td>
                  <td className="text-xs tabular-nums">{formatMoney(finding.financial_impact_kobo, true)}</td>
                  <td className="text-xs tabular-nums">{finding.action_count}</td>
                </tr>
              ))}
              {findings.length === 0 ? <tr><td colSpan={10} className="py-8 text-center text-sm text-slate-500">No findings match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {can(user, "findings.create") ? (
        <div className="mt-4" id="new-finding">
          <Panel title="Raise a new finding" description="Record an exception identified outside a checklist or start a new audit follow-up.">
            <form action={createFindingAction} className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Outlet</label><select name="outletId" required className="select"><option value="">Select outlet</option>{(await findingOptions(scope)).map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></div>
              <div><label className="label">Linked audit (optional)</label><select name="auditId" className="select"><option value="">No linked audit</option>{auditOptions.map((audit) => <option key={audit.id} value={audit.id}>{audit.ref} · {audit.outlet_name}</option>)}</select></div>
              <div><label className="label">Title</label><input name="title" required className="input" /></div>
              <div><label className="label">Category</label><select name="category" className="select">{AUDIT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div>
              <div><label className="label">Severity</label><select name="severity" className="select" defaultValue="medium">{SEVERITIES.map((severity) => <option key={severity.id} value={severity.id}>{severity.label}</option>)}</select></div>
              <div><label className="label">Financial impact (₦)</label><input name="financialImpact" type="number" min="0" step="0.01" defaultValue="0" className="input" /></div>
              <div><label className="label">Responsible officer</label><select name="responsibleUserId" className="select"><option value="">Outlet manager (default)</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name} · {titleCase(person.role)}</option>)}</select></div>
              <div><label className="label">Target completion</label><input name="targetDate" type="date" required defaultValue={DATE_PLUS_30} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" required className="textarea" /></div>
              <div><label className="label">Expected control</label><input name="expectedControl" className="input" /></div>
              <div><label className="label">Actual observation</label><input name="actualObservation" className="input" /></div>
              <div><label className="label">Root cause</label><input name="rootCause" className="input" /></div>
              <div><label className="label">Recommendation</label><input name="recommendation" className="input" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary">Create finding & assign action</SubmitButton></div>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
