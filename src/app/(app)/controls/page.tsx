import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { staffList } from "@/lib/data/lookups";
import { CONTROL_FREQUENCIES, DEPARTMENTS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createControlAction } from "./actions";

export const metadata = { title: "Internal controls" };

export default async function ControlsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("controls.view");
  const sp = await searchParams;
  const department = typeof sp.department === "string" ? sp.department : "";
  const effectiveness = typeof sp.effectiveness === "string" ? sp.effectiveness : "";
  const controls = all<{ id: string; control_ref: string; name: string; description: string; department: string; frequency: string; effectiveness: string; last_tested_at: string | null; next_test_at: string | null; owner_name: string | null; test_count: number; exceptions: number }>(
    `SELECT c.*, u.name owner_name, (SELECT count(*) FROM control_tests t WHERE t.control_id=c.id) test_count, (SELECT coalesce(sum(exceptions),0) FROM control_tests t WHERE t.control_id=c.id) exceptions FROM controls c LEFT JOIN users u ON u.id=c.owner_id WHERE (? = '' OR c.department=?) AND (? = '' OR c.effectiveness=?) ORDER BY c.department, c.name`,
    [department, department, effectiveness, effectiveness],
  );
  const rate = controls.length ? Math.round(((controls.filter((c) => c.effectiveness === "effective").length + controls.filter((c) => c.effectiveness === "partially_effective").length * 0.5) / controls.length) * 1000) / 10 : 0;
  const user = await requirePermission("controls.view");
  const manageable = can(user, "controls.manage");
  return (
    <div>
      <PageHeader eyebrow="Internal control framework" title="Internal controls" description="Control objectives, owners, test procedures, evidence requirements and operating effectiveness across departments." actions={manageable ? <a href="#new-control" className="btn-primary"><Plus className="size-4" /> New control</a> : null} />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Controls" value={controls.length} icon={<ShieldCheck className="size-4" />} />
        <KpiCard label="Effective" value={controls.filter((c) => c.effectiveness === "effective").length} tone="success" />
        <KpiCard label="Weak/ineffective" value={controls.filter((c) => ["ineffective", "partially_effective"].includes(c.effectiveness)).length} tone="warning" />
        <KpiCard label="Compliance rate" value={`${rate}%`} tone="info" />
      </section>
      <Panel title="Control register" description="Filter by department and effectiveness.">
        <form method="get" className="mb-3 flex flex-wrap gap-2"><select name="department" defaultValue={department} className="select max-w-48"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select><select name="effectiveness" defaultValue={effectiveness} className="select max-w-44"><option value="">All effectiveness</option><option value="effective">Effective</option><option value="partially_effective">Partially effective</option><option value="ineffective">Ineffective</option><option value="not_tested">Not tested</option></select><button className="btn-secondary" type="submit">Filter</button></form>
        <div className="table-wrap"><table className="table min-w-[900px]"><thead><tr><th>Control</th><th>Department</th><th>Owner</th><th>Frequency</th><th>Effectiveness</th><th>Last test</th><th>Next test</th><th>Tests</th></tr></thead><tbody>
          {controls.map((control) => (<tr key={control.id}><td><Link href={`/controls/${control.id}`} className="text-xs font-medium text-slate-800 hover:underline">{control.name}</Link><p className="text-[10px] font-mono text-slate-400">{control.control_ref} · {control.exceptions} exceptions</p></td><td className="text-xs">{control.department}</td><td className="text-xs">{control.owner_name ?? "—"}</td><td className="text-xs">{control.frequency}</td><td><StatusBadge status={control.effectiveness} /></td><td className="text-xs">{formatDate(control.last_tested_at)}</td><td className="text-xs">{formatDate(control.next_test_at)}</td><td className="text-xs tabular-nums">{control.test_count}</td></tr>))}
        </tbody></table></div>
      </Panel>
      {manageable ? (
        <div className="mt-4" id="new-control"><Panel title="Add a control" description="Define the control, its owner, testing procedure and evidence requirement.">
          <form action={createControlAction} className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Control name</label><input name="name" required className="input" /></div>
            <div><label className="label">Department</label><select name="department" className="select">{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" required className="textarea" /></div>
            <div><label className="label">Control objective</label><input name="objective" className="input" /></div>
            <div><label className="label">Owner</label><select name="ownerId" className="select"><option value="">Unassigned</option>{staffList().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Frequency</label><select name="frequency" className="select">{CONTROL_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
            <div><label className="label">Next test date</label><input name="nextTest" type="date" className="input" /></div>
            <div><label className="label">Test procedure</label><input name="testProcedure" className="input" /></div>
            <div><label className="label">Evidence required</label><input name="evidence" className="input" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary">Add control</SubmitButton></div>
          </form>
        </Panel></div>
      ) : null}
    </div>
  );
}
