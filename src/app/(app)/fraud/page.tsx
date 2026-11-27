import Link from "next/link";
import { DATE_TODAY } from "@/lib/defaults";
import { LockKeyhole, Plus, ShieldAlert } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { auditors, outletsForScope } from "@/lib/data/lookups";
import { FRAUD_TYPES } from "@/lib/constants";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createFraudCaseAction } from "./actions";

export const metadata = { title: "Fraud investigations" };

export default async function FraudPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("fraud.view");
  const scope = await getScope(user);
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const accessFilter = user.role === "head_audit" || user.role === "audit_manager" ? "1=1" : "(fc.officer_id=? OR fc.created_by=? OR fc.id IN (SELECT case_id FROM case_access WHERE user_id=?))";
  const accessParams = user.role === "head_audit" || user.role === "audit_manager" ? [] : [user.id, user.id, user.id];
  const cases = await all<{ id: string; ref: string; title: string; type: string; status: string; suspected_exposure_kobo: number; incident_date: string; officer_name: string; outlet_name: string | null; update_count: number }>(
    `SELECT fc.id, fc.ref, fc.title, fc.type, fc.status, fc.suspected_exposure_kobo, fc.incident_date, u.name officer_name, o.name outlet_name,
      (SELECT count(*) FROM fraud_updates fu WHERE fu.case_id=fc.id) update_count
     FROM fraud_cases fc JOIN users u ON u.id=fc.officer_id LEFT JOIN outlets o ON o.id=fc.outlet_id
     WHERE ${accessFilter} AND (? = '' OR fc.status=?) AND (? = '' OR fc.type=?) AND (? = '' OR fc.title LIKE ? OR fc.ref LIKE ?)
     ORDER BY CASE fc.status WHEN 'investigating' THEN 0 WHEN 'evidence_review' THEN 1 WHEN 'pending_closure' THEN 2 WHEN 'registered' THEN 3 ELSE 4 END, fc.opened_at DESC`,
    [...accessParams, status, status, type, type, q, `%${q}%`, `%${q}%`],
  );
  const manager = can(user, "fraud.manage");
  return (
    <div>
      <PageHeader eyebrow="Confidential · Restricted access" title="Fraud investigations" description="Restricted case management for suspected fraud, financial irregularity and misconduct. Every access and update is logged on a tamper-evident trail." actions={manager ? <a href="#new-case" className="btn-primary"><Plus className="size-4" /> Register case</a> : null} />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <div className="mb-4"><AlertBanner tone="red" title="Restricted module">Only the Head of Audit, Audit Manager and explicitly authorised officers may view these records.</AlertBanner></div>
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cases visible" value={cases.length} icon={<LockKeyhole className="size-4" />} />
        <KpiCard label="Open" value={cases.filter((c) => !["closed", "referred"].includes(c.status)).length} tone="danger" icon={<ShieldAlert className="size-4" />} />
        <KpiCard label="Suspected exposure" value={formatMoney(cases.reduce((sum, c) => sum + c.suspected_exposure_kobo, 0), true)} tone="warning" />
        <KpiCard label="Closed" value={cases.filter((c) => c.status === "closed").length} tone="success" />
      </section>
      <Panel title="Case register" description="Titles are confidential. Click a case to open only if authorised.">
        <form method="get" className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search reference or title" className="input max-w-64" /><select name="status" defaultValue={status} className="select max-w-40"><option value="">All statuses</option>{["registered","investigating","evidence_review","pending_closure","closed","referred"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select><select name="type" defaultValue={type} className="select max-w-48"><option value="">All types</option>{FRAUD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><button className="btn-secondary" type="submit">Filter</button></form>
        <div className="table-wrap"><table className="table min-w-[900px]"><thead><tr><th>Reference</th><th>Case</th><th>Type</th><th>Outlet</th><th>Officer</th><th>Status</th><th>Exposure</th><th>Updates</th></tr></thead><tbody>
          {cases.map((item) => (<tr key={item.id}><td><Link href={`/fraud/${item.id}`} className="font-mono text-[11px] text-slate-600 hover:underline">{item.ref}</Link></td><td><Link href={`/fraud/${item.id}`} className="text-xs font-medium text-slate-800 hover:underline">{item.title}</Link><p className="text-[10px] text-slate-400">Incident {formatDate(item.incident_date)}</p></td><td className="text-xs">{item.type}</td><td className="text-xs">{item.outlet_name ?? "—"}</td><td className="text-xs">{item.officer_name}</td><td><StatusBadge status={item.status} /></td><td className="text-xs tabular-nums">{formatMoney(item.suspected_exposure_kobo, true)}</td><td className="text-xs tabular-nums">{item.update_count}</td></tr>))}
          {!cases.length ? <tr><td colSpan={8} className="py-6 text-center text-sm text-slate-500">No cases visible to your account.</td></tr> : null}
        </tbody></table></div>
      </Panel>
      {manager ? (
        <div className="mt-4" id="new-case"><Panel title="Register a confidential case" description="Case access is restricted to you, the Head of Audit and the assigned investigation officer.">
          <form action={createFraudCaseAction} className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Case title</label><input name="title" required className="input" /></div>
            <div><label className="label">Fraud type</label><select name="type" className="select">{FRAUD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div><label className="label">Investigation officer</label><select name="officerId" required className="select"><option value="">Assign officer</option>{(await auditors()).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="label">Outlet</label><select name="outletId" className="select"><option value="">No specific outlet</option>{(await outletsForScope(scope)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className="label">Suspected exposure (₦)</label><input name="exposure" type="number" min="0" step="0.01" className="input" /></div>
            <div><label className="label">Incident date</label><input name="incidentDate" type="date" required defaultValue={DATE_TODAY} className="input" /></div>
            <div><label className="label">Incident location</label><input name="location" className="input" /></div>
            <div><label className="label">Witness information</label><input name="witnesses" className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Case description</label><textarea name="description" required className="textarea" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary">Register confidential case</SubmitButton></div>
          </form>
        </Panel></div>
      ) : null}
    </div>
  );
}
