import Link from "next/link";
import { DATE_TODAY, YEAR_START } from "@/lib/defaults";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { approvedAuditsForReports } from "@/lib/data/lookups";
import { listReports, REPORT_KINDS } from "@/lib/reports";
import { formatDate, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { generateReportAction } from "./actions";

export const metadata = { title: "Audit reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("reports.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  const reports = listReports(scope, user, { q, kind });
  const audits = approvedAuditsForReports(scope);
  const generate = can(user, "reports.generate");
  return (
    <div>
      <PageHeader eyebrow="Reporting centre" title="Audit reports" description="Generate, approve, print and export board-ready audit, risk, compliance, fraud and remediation reports." />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Reports" value={reports.length} icon={<FileText className="size-4" />} /><KpiCard label="Approved" value={reports.filter((r) => r.status === "approved").length} tone="success" /><KpiCard label="Audit reports" value={reports.filter((r) => r.kind === "audit").length} tone="info" /><KpiCard label="Report types" value={REPORT_KINDS.length} icon={<FileSpreadsheet className="size-4" />} /></section>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          {generate ? (<Panel title="Generate a report" description="Reports snapshot live data at the moment of generation.">
            <form action={generateReportAction} className="grid gap-2">
              <select name="kind" className="select" required>{REPORT_KINDS.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
              <select name="auditId" className="select"><option value="">Select audit (for audit report)</option>{audits.map((audit) => <option key={audit.id} value={audit.id}>{audit.ref} · {audit.outlet_name}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><input name="from" type="date" className="input" defaultValue={YEAR_START} /><input name="to" type="date" className="input" defaultValue={DATE_TODAY} /></div>
              <SubmitButton className="btn-primary">Generate report</SubmitButton>
            </form>
          </Panel>) : null}
          <Panel title="Report library" description="Audit, assurance and management reporting."><ul className="space-y-1.5 text-[11px] text-slate-500">{REPORT_KINDS.map((type) => <li key={type.id} className="flex items-start gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-300" /><span><b className="text-slate-700">{type.label}</b><br />{type.description}</span></li>)}</ul></Panel>
        </div>
        <Panel title="Generated reports" description="Approved and submitted reports. Open a report to print, export PDF or Excel.">
          <form method="get" className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search reports" className="input max-w-60" /><select name="kind" defaultValue={kind} className="select max-w-56"><option value="">All report types</option>{REPORT_KINDS.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select><button className="btn-secondary" type="submit">Filter</button></form>
          <div className="space-y-2">{reports.map((report) => (<div key={report.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2.5"><div className="min-w-0"><Link href={`/reports/${report.id}`} className="text-xs font-semibold text-slate-800 hover:underline">{report.title}</Link><p className="text-[10px] text-slate-400">{report.report_ref} · {titleCase(report.kind)} · {formatDate(report.generated_at)} · {report.generated_by_name ?? "System"}</p></div><div className="flex items-center gap-2"><StatusBadge status={report.status} /><Link href={`/api/reports/${report.id}/pdf`} className="btn-secondary btn-sm" title="Download PDF"><FileText className="size-3" /></Link><Link href={`/api/reports/${report.id}/xlsx`} className="btn-secondary btn-sm" title="Download Excel"><FileSpreadsheet className="size-3" /></Link><Link href={`/reports/${report.id}/print`} className="btn-secondary btn-sm" title="Print"><Printer className="size-3" /></Link></div></div>))}{!reports.length ? <p className="py-6 text-center text-sm text-slate-500">No reports available.</p> : null}</div>
        </Panel>
      </div>
    </div>
  );
}
