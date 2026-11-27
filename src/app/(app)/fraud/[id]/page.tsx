import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { all, get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { canViewFraudCase } from "@/lib/scope";
import { verifyFraudChain } from "@/lib/activity";
import { formatDate, formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { EvidenceUpload } from "@/components/evidence-upload";
import { SubmitButton } from "@/components/submit-button";
import { addFraudUpdateAction, closeFraudCaseAction, grantCaseAccessAction } from "../actions";

export default async function FraudDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("fraud.view");
  const { id } = await params;
  const sp = await searchParams;
  if (!canViewFraudCase(user, id)) notFound();
  const fraud = get<{ id: string; ref: string; title: string; type: string; description: string; suspected_exposure_kobo: number; incident_date: string; location: string | null; witnesses: string | null; status: string; conclusion: string | null; opened_at: string; closed_at: string | null; officer_name: string; outlet_name: string | null; creator_name: string | null; approver_name: string | null }>(
    `SELECT fc.*, u.name officer_name, o.name outlet_name, c.name creator_name, a.name approver_name FROM fraud_cases fc JOIN users u ON u.id=fc.officer_id LEFT JOIN outlets o ON o.id=fc.outlet_id LEFT JOIN users c ON c.id=fc.created_by LEFT JOIN users a ON a.id=fc.closure_approved_by WHERE fc.id=?`, [id]);
  if (!fraud) notFound();
  const updates = all<{ id: string; kind: string; content: string; occurred_at: string; author_name: string; hash: string }>(
    `SELECT fu.*, u.name author_name FROM fraud_updates fu LEFT JOIN users u ON u.id=fu.author_id WHERE fu.case_id=? ORDER BY fu.created_at DESC`, [id]);
  const documents = all<{ id: string; ref: string; original_name: string; uploaded_by_name: string | null; created_at: string }>(
    `SELECT d.id, d.ref, d.original_name, u.name uploaded_by_name, d.created_at FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by WHERE d.fraud_case_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC`, [id]);
  const accessList = all<{ name: string; email: string; granted_at: string; granted_by_name: string | null }>(
    `SELECT u.name, u.email, ca.granted_at, g.name granted_by_name FROM case_access ca JOIN users u ON u.id=ca.user_id LEFT JOIN users g ON g.id=ca.granted_by WHERE ca.case_id=?`, [id]);
  const chain = verifyFraudChain(id);
  const manager = can(user, "fraud.manage");
  const investigator = can(user, "fraud.investigate");
  return (
    <div>
      <PageHeader eyebrow={`${fraud.ref} · Restricted investigation`} title={fraud.title} description={`${fraud.type} · ${fraud.outlet_name ?? "Organisation-wide"} · Officer ${fraud.officer_name}`} actions={<Link href="/fraud" className="btn-secondary"><ArrowLeft className="size-4" /> Cases</Link>} />
      {sp.updated === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Investigation update recorded" /></div> : null}
      {sp.access === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Case access granted" /></div> : null}
      {sp.closed === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Case closure approved" /></div> : null}
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={fraud.status} /><span className="badge bg-slate-900 text-white ring-slate-900"><LockKeyhole className="size-3" /> Confidential</span><span className={chain.valid ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-red-50 text-red-700 ring-red-200"}><Fingerprint className="size-3" /> {chain.valid ? `Chain verified · ${chain.count} updates` : "Chain integrity warning"}</span></div>
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Suspected exposure" value={formatMoney(fraud.suspected_exposure_kobo, true)} tone="danger" /><KpiCard label="Incident date" value={formatDate(fraud.incident_date)} /><KpiCard label="Opened" value={formatDate(fraud.opened_at)} /><KpiCard label="Updates" value={updates.length} /></section>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title="Case summary" description="Confidential description and scope."><div className="space-y-3"><p className="text-sm leading-6 text-slate-700">{fraud.description}</p><DetailList items={[{ label: "Location", value: fraud.location ?? "—" }, { label: "Witness information", value: fraud.witnesses ?? "—" }, { label: "Investigation officer", value: fraud.officer_name }, { label: "Registered by", value: fraud.creator_name ?? "—" }, { label: "Closure approved by", value: fraud.approver_name ? `${fraud.approver_name} · ${formatDateTime(fraud.closed_at)}` : "—" }]} />{fraud.conclusion ? <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="eyebrow !text-emerald-600">Closure conclusion</p><p className="mt-1 text-xs leading-5 text-slate-700">{fraud.conclusion}</p></div> : null}</div></Panel>
          <Panel title="Investigation trail" description="Append-only notes, interviews, evidence and escalations.">
            <div className="space-y-3">{updates.map((update) => <div key={update.id} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-slate-700">{titleCase(update.kind)} · {update.author_name}</p><span className="text-[9px] text-slate-400">{formatDateTime(update.occurred_at)}</span></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{update.content}</p><p className="mt-1 truncate font-mono text-[8px] text-slate-300">hash {update.hash.slice(0, 24)}…</p></div>)}{!updates.length ? <p className="text-xs text-slate-500">No updates recorded.</p> : null}</div>
            {investigator ? (<form action={addFraudUpdateAction} className="mt-4 space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="caseId" value={fraud.id} /><select name="kind" className="select"><option value="note">Investigation note</option><option value="interview">Interview record</option><option value="evidence">Evidence record</option><option value="escalation">Escalation</option></select><textarea name="content" required className="textarea" placeholder="Record the update — this cannot be edited or deleted" /><SubmitButton className="btn-primary">Add update</SubmitButton></form>) : null}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Case evidence" description="Restricted documents."><div className="space-y-2">{documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2"><div className="flex min-w-0 items-center gap-2"><FileText className="size-3.5 text-slate-400" /><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-700">{document.original_name}</p><p className="text-[9px] text-slate-400">{document.ref}</p></div></div><a href={`/api/files/${document.id}`} target="_blank" className="text-[10px] font-semibold text-slate-500 hover:underline">View</a></div>)}{!documents.length ? <p className="text-xs text-slate-500">No evidence uploaded.</p> : null}</div><div className="mt-3 border-t border-slate-100 pt-3"><EvidenceUpload fraudCaseId={fraud.id} category="investigation_evidence" label="Upload restricted evidence" /></div></Panel>
          <Panel title="Authorised access" description="Case access is explicit and audited."><ul className="space-y-2">{accessList.map((access) => <li key={access.email} className="text-[11px]"><p className="font-medium text-slate-700">{access.name}</p><p className="text-[10px] text-slate-400">{access.email} · granted by {access.granted_by_name ?? "—"}</p></li>)}</ul>{manager ? (<form action={grantCaseAccessAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="caseId" value={fraud.id} /><input name="email" type="email" required placeholder="user@crunchiesfood.com" className="input" /><SubmitButton className="btn-secondary">Grant access</SubmitButton></form>) : null}</Panel>
          {manager && user.role === "head_audit" && fraud.status !== "closed" ? (<Panel title="Approve closure" description="Closure requires a documented conclusion."><form action={closeFraudCaseAction} className="space-y-2"><input type="hidden" name="caseId" value={fraud.id} /><textarea name="conclusion" required className="textarea" placeholder="Investigation conclusion, outcome and recovery action" /><SubmitButton className="btn-primary"><ShieldCheck className="size-4" /> Approve closure</SubmitButton></form></Panel>) : null}
        </div>
      </div>
    </div>
  );
}
