import Link from "next/link";
import { DATE_TODAY } from "@/lib/defaults";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { all, get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { allAuditsForSelect } from "@/lib/data/lookups";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { recordControlTestAction } from "../actions";

export default async function ControlDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("controls.view");
  const scope = getScope(user);
  const { id } = await params;
  const sp = await searchParams;
  const control = get<{ id: string; control_ref: string; name: string; description: string; objective: string | null; department: string; frequency: string; test_procedure: string | null; evidence_required: string | null; effectiveness: string; last_tested_at: string | null; next_test_at: string | null; owner_name: string | null }>(
    `SELECT c.*, u.name owner_name FROM controls c LEFT JOIN users u ON u.id=c.owner_id WHERE c.id=?`, [id]);
  if (!control) notFound();
  const tests = all<{ id: string; tested_at: string; result: string; sample_size: number | null; exceptions: number; notes: string | null; tester_name: string | null; audit_ref: string | null }>(
    `SELECT t.*, u.name tester_name, a.ref audit_ref FROM control_tests t LEFT JOIN users u ON u.id=t.tester_id LEFT JOIN audits a ON a.id=t.audit_id WHERE t.control_id=? ORDER BY t.tested_at DESC`, [id]);
  return (
    <div>
      <PageHeader eyebrow={`${control.control_ref} · ${control.department}`} title={control.name} description={`Owner: ${control.owner_name ?? "Unassigned"} · ${control.frequency}`} actions={<Link href="/controls" className="btn-secondary"><ArrowLeft className="size-4" /> Controls</Link>} />
      {sp.tested === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Control test recorded" /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Effectiveness" value={titleCase(control.effectiveness)} tone={control.effectiveness === "effective" ? "success" : control.effectiveness === "ineffective" ? "danger" : "warning"} /><KpiCard label="Last tested" value={formatDate(control.last_tested_at)} /><KpiCard label="Next test" value={formatDate(control.next_test_at)} /><KpiCard label="Test history" value={tests.length} /></section>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Control definition"><div className="space-y-3 text-sm leading-6 text-slate-700"><div><p className="eyebrow">Description</p><p className="mt-1">{control.description}</p></div><DetailList items={[{ label: "Objective", value: control.objective ?? "—" }, { label: "Test procedure", value: control.test_procedure ?? "—" }, { label: "Evidence required", value: control.evidence_required ?? "—" }, { label: "Frequency", value: control.frequency }]} /></div></Panel>
        <Panel title="Record a test" description="Testing updates effectiveness and schedules the next review.">
          {can(user, "controls.test") ? (<form action={recordControlTestAction} className="space-y-2"><input type="hidden" name="controlId" value={control.id} /><select name="result" className="select"><option value="effective">Effective</option><option value="partially_effective">Partially effective</option><option value="ineffective">Ineffective</option></select><input name="testedAt" type="date" className="input" defaultValue={DATE_TODAY} /><div className="grid grid-cols-2 gap-2"><input name="sampleSize" type="number" min="0" placeholder="Sample size" className="input" /><input name="exceptions" type="number" min="0" placeholder="Exceptions" className="input" /></div><select name="auditId" className="select"><option value="">No linked audit</option>{allAuditsForSelect(scope).slice(0, 50).map((audit) => <option key={audit.id} value={audit.id}>{audit.ref}</option>)}</select><textarea name="notes" className="textarea min-h-16" placeholder="Testing notes" /><SubmitButton className="btn-primary">Record test</SubmitButton></form>) : <p className="text-xs text-slate-500">You have view-only access.</p>}
        </Panel>
      </div>
      <div className="mt-4"><Panel title="Test history" description="Sampled evidence and exceptions."><div className="table-wrap"><table className="table min-w-[720px]"><thead><tr><th>Date</th><th>Result</th><th>Tester</th><th>Sample</th><th>Exceptions</th><th>Notes</th></tr></thead><tbody>{tests.map((test) => <tr key={test.id}><td className="text-xs">{formatDateTime(test.tested_at)}</td><td><StatusBadge status={test.result} /></td><td className="text-xs">{test.tester_name ?? "—"}</td><td className="text-xs">{test.sample_size ?? "—"}</td><td className="text-xs text-red-600">{test.exceptions}</td><td className="max-w-80 text-xs text-slate-500">{test.notes ?? "—"}</td></tr>)}{!tests.length ? <tr><td colSpan={6} className="py-5 text-center text-sm text-slate-500">No tests recorded.</td></tr> : null}</tbody></table></div></Panel></div>
    </div>
  );
}
