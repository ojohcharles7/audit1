import Link from "next/link";
import { Plus, ShieldCheck, UserRound } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLE_IDS, ROLE_LABELS } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { outletsForScope } from "@/lib/data/lookups";
import { regions } from "@/lib/data/lookups";
import { formatDate, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createStaffAction } from "./actions";

export const metadata = { title: "Staff & auditors" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission("staff.view");
  const scope = getScope(actor);
  const sp = await searchParams;
  const role = typeof sp.role === "string" ? sp.role : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const staff = all<{ id: string; name: string; email: string; role: string; title: string; status: string; last_login_at: string | null; outlet_name: string | null; region_name: string | null; audits: number }>(
    `SELECT u.*, o.name outlet_name, r.name region_name, (SELECT count(*) FROM audits a WHERE a.auditor_id=u.id) audits
     FROM users u LEFT JOIN outlets o ON o.id=u.outlet_id LEFT JOIN regions r ON r.id=u.region_id
     WHERE u.deleted_at IS NULL AND (? = '' OR u.role=?) AND (? = '' OR u.name LIKE ? OR u.email LIKE ?)
     ORDER BY CASE u.role WHEN 'head_audit' THEN 0 WHEN 'audit_manager' THEN 1 WHEN 'auditor' THEN 2 WHEN 'regional_manager' THEN 3 ELSE 4 END, u.name`,
    [role, role, q, `%${q}%`, `%${q}%`],
  );
  const manager = can(actor, "staff.manage");
  return (
    <div>
      <PageHeader eyebrow="People & access" title="Staff & auditors" description="User accounts, roles, outlet and regional assignments, auditor workload and account status." actions={manager ? <a href="#new-staff" className="btn-primary"><Plus className="size-4" /> Add staff</a> : null} />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      {sp.created === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Account created" /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Staff accounts" value={staff.length} icon={<UserRound className="size-4" />} />
        <KpiCard label="Auditors" value={staff.filter((s) => s.role === "auditor").length} tone="info" />
        <KpiCard label="Regional managers" value={staff.filter((s) => s.role === "regional_manager").length} />
        <KpiCard label="Active" value={staff.filter((s) => s.status === "active").length} tone="success" icon={<ShieldCheck className="size-4" />} />
      </section>
      <Panel title="Directory" description="Role determines module access and data scope.">
        <form method="get" className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Name or email" className="input max-w-60" /><select name="role" defaultValue={role} className="select max-w-52"><option value="">All roles</option>{ROLE_IDS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select><button className="btn-secondary" type="submit">Filter</button></form>
        <div className="table-wrap"><table className="table min-w-[900px]"><thead><tr><th>Name</th><th>Role</th><th>Assignment</th><th>Audits</th><th>Last login</th><th>Status</th></tr></thead><tbody>
          {staff.map((person) => (<tr key={person.id}><td><Link href={`/staff/${person.id}`} className="text-xs font-medium text-slate-800 hover:underline">{person.name}</Link><p className="text-[10px] text-slate-400">{person.email}</p></td><td className="text-xs">{ROLE_LABELS[person.role as keyof typeof ROLE_LABELS] ?? titleCase(person.role)}<p className="text-[10px] text-slate-400">{person.title}</p></td><td className="text-xs">{person.outlet_name ?? person.region_name ?? "Organisation-wide"}</td><td className="text-xs tabular-nums">{person.audits}</td><td className="text-xs">{formatDate(person.last_login_at)}</td><td><span className={`badge ${person.status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-slate-200"}`}>{titleCase(person.status)}</span></td></tr>))}
        </tbody></table></div>
      </Panel>
      {manager ? (
        <div className="mt-4" id="new-staff"><Panel title="Add a staff account" description="Passwords are hashed with PBKDF2-SHA256. Share the initial password through a secure channel.">
          <form action={createStaffAction} className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Full name</label><input name="name" required className="input" /></div>
            <div><label className="label">Email</label><input name="email" type="email" required className="input" /></div>
            <div><label className="label">Role</label><select name="role" className="select">{ROLE_IDS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
            <div><label className="label">Title</label><input name="title" className="input" /></div>
            <div><label className="label">Outlet (outlet managers)</label><select name="outletId" className="select"><option value="">None</option>{outletsForScope(scope).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label className="label">Region (regional managers)</label><select name="regionId" className="select"><option value="">None</option>{regions().map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div><label className="label">Initial password</label><input name="password" type="password" required minLength={8} className="input" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary">Create account</SubmitButton></div>
          </form>
        </Panel></div>
      ) : null}
    </div>
  );
}
