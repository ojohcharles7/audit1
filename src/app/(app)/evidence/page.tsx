import Link from "next/link";
import { FileLock2, FileText, FolderLock, HardDrive } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { outletScopeSql } from "@/lib/scope";
import { outletsForScope } from "@/lib/data/lookups";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { uploadEvidenceAction } from "./actions";

export const metadata = { title: "Evidence repository" };

export default async function EvidencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("evidence.view");
  const scope = await getScope(user);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const scopeSql = outletScopeSql(scope, "o");
  const accessSql = scope.all ? "1=1" : `(d.outlet_id IN (SELECT o.id FROM outlets o WHERE ${scopeSql.sql}) OR d.audit_id IN (SELECT a.id FROM audits a JOIN outlets o ON o.id=a.outlet_id WHERE ${scopeSql.sql}) OR d.finding_id IN (SELECT f.id FROM findings f JOIN outlets o ON o.id=f.outlet_id WHERE ${scopeSql.sql}))`;
  const params = scope.all ? [] : [...scopeSql.params, ...scopeSql.params, ...scopeSql.params];
  const documents = await all<{ id: string; ref: string; original_name: string; category: string; mime_type: string; size_bytes: number; confidentiality: string; created_at: string; uploaded_by_name: string | null; outlet_name: string | null }>(
    `SELECT d.id, d.ref, d.original_name, d.category, d.mime_type, d.size_bytes, d.confidentiality, d.created_at, u.name uploaded_by_name, o.name outlet_name
     FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by LEFT JOIN outlets o ON o.id=d.outlet_id
     WHERE d.deleted_at IS NULL AND ${accessSql} AND (? = '' OR d.original_name LIKE ?) AND (? = '' OR d.category=?)
     ORDER BY d.created_at DESC LIMIT 200`,
    [...params, q, `%${q}%`, category, category],
  );
  const totalBytes = documents.reduce((sum, document) => sum + document.size_bytes, 0);
  const canUpload = can(user, "evidence.upload");
  return (
    <div>
      <PageHeader eyebrow="Secure document management" title="Evidence repository" description="Centrally stored audit evidence, working papers, receipts, invoices and investigation records with access tracking." />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      {sp.uploaded === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Evidence uploaded">Document checksum and access trail recorded.</AlertBanner></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Documents" value={documents.length} icon={<FolderLock className="size-4" />} />
        <KpiCard label="Storage used" value={`${formatNumber(totalBytes / 1024 / 1024)} MB`} icon={<HardDrive className="size-4" />} />
        <KpiCard label="Restricted" value={documents.filter((d) => d.confidentiality === "restricted").length} tone="danger" icon={<FileLock2 className="size-4" />} />
        <KpiCard label="Categories" value={new Set(documents.map((d) => d.category)).size} tone="info" />
      </section>
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        {canUpload ? (
          <Panel title="Upload evidence" description="Files are stored outside the public web root and served through authenticated access only.">
            <form action={uploadEvidenceAction} className="space-y-2">
              <input name="file" type="file" required className="block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-white" />
              <select name="outletId" required className="select"><option value="">Select outlet</option>{(await outletsForScope(scope)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <select name="category" className="select"><option value="general">General</option><option value="audit_working_paper">Audit working paper</option><option value="photo_evidence">Photo evidence</option><option value="receipt">Receipt</option><option value="invoice">Invoice</option><option value="cctv">CCTV export reference</option><option value="financial_record">Financial record</option></select>
              <input name="description" placeholder="Description" className="input" />
              <p className="text-[10px] leading-4 text-slate-400">Permitted: images, PDF, Office, CSV, text and ZIP. Maximum 15MB.</p>
              <SubmitButton className="btn-primary">Upload document</SubmitButton>
            </form>
          </Panel>
        ) : null}
        <Panel title="Document library" description="Every download is logged with user, time and IP address.">
          <form method="get" className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search file name" className="input max-w-64" /><select name="category" defaultValue={category} className="select max-w-52"><option value="">All categories</option>{["general","audit_working_paper","photo_evidence","receipt","invoice","cctv","financial_record","investigation_evidence","remediation_evidence"].map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select><button className="btn-secondary" type="submit">Filter</button></form>
          <div className="table-wrap"><table className="table min-w-[760px]"><thead><tr><th>Document</th><th>Category</th><th>Outlet</th><th>Uploaded by</th><th>Date</th><th /></tr></thead><tbody>
            {documents.map((document) => (<tr key={document.id}><td><div className="flex items-center gap-2"><FileText className="size-4 text-slate-400" /><div><p className="max-w-72 truncate text-xs font-medium text-slate-800">{document.original_name}</p><p className="text-[10px] font-mono text-slate-400">{document.ref} · {formatNumber(document.size_bytes / 1024)} KB</p></div></div></td><td className="text-xs">{titleCase(document.category)}</td><td className="text-xs">{document.outlet_name ?? "—"}</td><td className="text-xs">{document.uploaded_by_name ?? "—"}</td><td className="text-xs">{formatDateTime(document.created_at)}</td><td className="text-right"><a href={`/api/files/${document.id}?download=1`} className="btn-secondary btn-sm">Download</a></td></tr>))}
            {!documents.length ? <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">No documents match the filters.</td></tr> : null}
          </tbody></table></div>
          <p className="mt-2 text-[10px] text-slate-400">Need a record audit trail? <Link href="/logs" className="font-semibold text-slate-600 hover:underline">View activity logs</Link>.</p>
        </Panel>
      </div>
    </div>
  );
}
