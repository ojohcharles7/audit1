import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, Printer, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { reportRecord } from "@/lib/reports";
import { AlertBanner, PageHeader, StatusBadge } from "@/components/ui";
import { ReportView } from "@/components/report-view";
import { SubmitButton } from "@/components/submit-button";
import { approveReportAction } from "../actions";

export default async function ReportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("reports.view");
  const scope = await getScope(user);
  const { id } = await params;
  const sp = await searchParams;
  const report = await reportRecord(user, scope, id);
  if (!report) notFound();
  return (
    <div>
      <PageHeader eyebrow={report.report_ref} title={report.title} description={`${report.generated_by_name ?? "System"} · ${report.generated_at.slice(0, 10)}`} actions={<><Link href="/reports" className="btn-secondary"><ArrowLeft className="size-4" /> Reports</Link><Link href={`/api/reports/${report.id}/pdf`} className="btn-secondary"><FileText className="size-4" /> PDF</Link><Link href={`/api/reports/${report.id}/xlsx`} className="btn-secondary"><FileSpreadsheet className="size-4" /> Excel</Link><Link href={`/reports/${report.id}/print`} className="btn-dark"><Printer className="size-4" /> Print</Link></>} />
      {sp.generated === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Report generated">The snapshot is immutable and available for export.</AlertBanner></div> : null}
      {sp.approved === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Report approved" /></div> : null}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={report.status} /><span className="badge bg-red-50 text-red-700 ring-red-200">{report.confidentiality}</span><span className="badge bg-slate-50 text-slate-600 ring-slate-200">Version {report.version}</span>{can(user, "reports.approve") && report.status !== "approved" ? (<form action={approveReportAction} className="ml-auto"><input type="hidden" name="reportId" value={report.id} /><SubmitButton className="btn-primary"><ShieldCheck className="size-4" /> Approve report</SubmitButton></form>) : null}</div>
      <ReportView snapshot={report.snapshot} />
    </div>
  );
}
