import ExcelJS from "exceljs";
import { getSessionUser } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { reportRecord } from "@/lib/reports";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const report = reportRecord(user, getScope(user), id);
  if (!report) return new Response("Not found", { status: 404 });
  const snapshot = report.snapshot;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Crunchies Internal Audit";
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ header: "Field", key: "field", width: 30 }, { header: "Value", key: "value", width: 55 }];
  summary.addRows([
    { field: "Report", value: snapshot.meta.title },
    { field: "Reference", value: report.report_ref },
    { field: "Period", value: snapshot.meta.period },
    { field: "Prepared by", value: snapshot.meta.preparedBy },
    { field: "Classification", value: snapshot.meta.confidentiality },
    ...snapshot.summary.map((item) => ({ field: item.label, value: item.value })),
  ]);
  summary.getRow(1).font = { bold: true };
  snapshot.sections.forEach((section, index) => {
    const name = `S${index + 1}`.slice(0, 31);
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(["Section"]).font = { bold: true };
    sheet.addRow([section.heading]);
    if (section.body) sheet.addRow([section.body]);
    if (section.columns && section.rows) {
      sheet.addRow([]);
      sheet.addRow(section.columns).font = { bold: true };
      for (const row of section.rows) sheet.addRow(row.map((cell) => String(cell)));
      sheet.columns.forEach((column) => { column.width = 24; });
    }
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.report_ref}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
