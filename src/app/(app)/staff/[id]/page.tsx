import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { all, get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can, ROLE_IDS, ROLE_LABELS } from "@/lib/auth/permissions";
import { outletsForScope, regions } from "@/lib/data/lookups";
import { getScope } from "@/lib/scope";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, Score, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { resetPasswordAction, updateStaffAction } from "../actions";

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission("staff.view");
  const scope = await getScope(actor);
  const { id } = await params;
  const sp = await searchParams;
  const person = await get<{ id: string; name: string; email: string; role: string; title: string; phone: string | null; status: string; mfa_enabled: number; last_login_at: string | null; created_at: string; outlet_id: string | null; region_id: string | null; outlet_name: string | null; region_name: string | null }>(
    `SELECT u.*, o.name outlet_name, r.name region_name FROM users u LEFT JOIN outlets o ON o.id=u.outlet_id LEFT JOIN regions r ON r.id=u.region_id WHERE u.id=? AND u.deleted_at IS NULL`, [id]);
  if (!person) notFound();
  const audits = await all<{ id: string; ref: string; title: string; status: string; score: number | null; planned_date: string; outlet_name: string }>(
    `SELECT a.id, a.ref, a.title, a.status, a.score, a.planned_date, o.name outlet_name FROM audits a JOIN outlets o ON o.id=a.outlet_id WHERE a.auditor_id=? ORDER BY a.planned_date DESC LIMIT 10`, [id]);
  const stats = await get<{ audits: number; findings: number; actions: number; avg_score: number }>(
    `SELECT (SELECT count(*) FROM audits WHERE auditor_id=?) audits, (SELECT count(*) FROM findings WHERE created_by=?) findings, (SELECT count(*) FROM corrective_actions WHERE officer_id=?) actions, (SELECT coalesce(round(avg(score)::numeric,1),0) FROM audits WHERE auditor_id=? AND score IS NOT NULL) avg_score`,
    [id, id, id, id]);
  const manager = can(actor, "staff.manage");
  return (
    <div>
      <PageHeader eyebrow={ROLE_LABELS[person.role as keyof typeof ROLE_LABELS] ?? titleCase(person.role)} title={person.name} description={`${person.email} · ${person.title}`} actions={<Link href="/staff" className="btn-secondary"><ArrowLeft className="size-4" /> Directory</Link>} />
      {sp.updated === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Account updated" /></div> : null}
      {sp.password === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Password reset and sessions revoked" /></div> : null}
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Audits" value={stats?.audits ?? 0} /><KpiCard label="Average score" value={stats?.avg_score ? <Score value={stats.avg_score} /> : "—"} tone="info" /><KpiCard label="Findings raised" value={stats?.findings ?? 0} tone="warning" /><KpiCard label="Actions owned" value={stats?.actions ?? 0} /></section>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Profile & assignment"><DetailList items={[{ label: "Name", value: person.name }, { label: "Email", value: person.email }, { label: "Role", value: ROLE_LABELS[person.role as keyof typeof ROLE_LABELS] ?? titleCase(person.role) }, { label: "Title", value: person.title }, { label: "Phone", value: person.phone ?? "—" }, { label: "Outlet", value: person.outlet_name ?? "—" }, { label: "Region", value: person.region_name ?? "—" }, { label: "Status", value: <StatusBadge status={person.status} /> }, { label: "MFA", value: person.mfa_enabled ? "Enabled" : "Not enabled" }, { label: "Last login", value: formatDateTime(person.last_login_at) }, { label: "Created", value: formatDate(person.created_at) }]} /></Panel>
        <Panel title="Recent audits" description="Latest fieldwork by this user."><ul className="divide-y divide-slate-100">{audits.map((audit) => <li key={audit.id} className="py-2 first:pt-0 last:pb-0"><Link href={`/audits/${audit.id}`} className="block truncate text-[11px] font-medium text-slate-800 hover:underline">{audit.title}</Link><p className="text-[10px] text-slate-400">{audit.ref} · {formatDate(audit.planned_date)} · <Score value={audit.score} /></p></li>)}{!audits.length ? <li className="text-xs text-slate-500">No audits assigned.</li> : null}</ul></Panel>
      </div>
      {manager ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel title="Update account" description="Assign role, outlet or region and control access.">
            <form action={updateStaffAction} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="userId" value={person.id} />
              <div><label className="label">Role</label><select name="role" defaultValue={person.role} className="select">{ROLE_IDS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
              <div><label className="label">Status</label><select name="status" defaultValue={person.status} className="select"><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
              <div className="sm:col-span-2"><label className="label">Title</label><input name="title" defaultValue={person.title} className="input" /></div>
              <div><label className="label">Outlet</label><select name="outletId" defaultValue={person.outlet_id ?? ""} className="select"><option value="">None</option>{(await outletsForScope(scope)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
              <div><label className="label">Region</label><select name="regionId" defaultValue={person.region_id ?? ""} className="select"><option value="">None</option>{(await regions()).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary">Save changes</SubmitButton></div>
            </form>
          </Panel>
          <Panel title="Reset password" description="Resets the password and revokes all active sessions.">
            <form action={resetPasswordAction} className="space-y-2"><input type="hidden" name="userId" value={person.id} /><input name="password" type="password" minLength={8} required className="input" placeholder="New temporary password" /><SubmitButton className="btn-secondary">Reset password</SubmitButton></form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
