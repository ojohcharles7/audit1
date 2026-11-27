import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { reportRecord } from "@/lib/reports";
import { ReportView } from "@/components/report-view";
import { PrintButton } from "@/components/print-button";

export default async function PrintReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("reports.view");
  const scope = getScope(user);
  const { id } = await params;
  const report = reportRecord(user, scope, id);
  if (!report) notFound();
  return (
    <div className="bg-slate-100 p-2 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[900px] justify-end"><PrintButton /></div>
      <ReportView snapshot={report.snapshot} />
    </div>
  );
}
