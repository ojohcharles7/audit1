import Link from "next/link";
import { DATE_PLUS_30 } from "@/lib/defaults";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { getFinding } from "@/lib/data/findings";
import { staffList } from "@/lib/data/lookups";
import { categoryLabel, DEPARTMENTS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, isOverdue, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, Progress, SeverityBadge, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { EvidenceUpload } from "@/components/evidence-upload";
import {
  addCorrectiveActionFromFindingAction,
  closeFindingAction,
  rejectFindingAction,
  respondToFindingAction,
  verifyFindingAction,
} from "../actions";

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("findings.view");
  const scope = await getScope(user);
  const { id } = await params;
  const sp = await searchParams;
  const data = await getFinding(scope, id);
  if (!data) notFound();
  const { finding, actions, history, evidence, escalations, sourceQuestion } = data;
  const staff = await staffList();
  const overdue = isOverdue(finding.target_date, finding.status) && !["resolved", "rejected"].includes(finding.status);
  const allActionsDone = actions.length > 0 && actions.every((action) => ["verified", "closed"].includes(action.status));
  const canRespond = can(user, "findings.respond") && !["resolved", "rejected"].includes(finding.status);
  const canVerify = can(user, "findings.verify") && !["resolved", "rejected"].includes(finding.status);
  const canClose = can(user, "findings.close") && Boolean(finding.verified_at) && finding.status !== "resolved";

  return (
    <div>
      <PageHeader
        eyebrow={`${finding.ref} · ${categoryLabel(finding.category)}`}
        title={finding.title}
        description={`${finding.outlet_name} (${finding.outlet_code}) · ${finding.audit_ref ? `Audit ${finding.audit_ref}` : "Continuous review"}`}
        actions={<Link href="/findings" className="btn-secondary"><ArrowLeft className="size-4" /> All findings</Link>}
      />

      {typeof sp.error === "string" ? <div className="mb-4"><AlertBanner tone="red" title={sp.error} /></div> : null}
      {sp.created === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Finding created and assigned" /></div> : null}
      {sp.responded === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Management response recorded" /></div> : null}
      {sp.verified === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Remediation verified" >Awaiting authorised closure by the Head of Internal Audit.</AlertBanner></div> : null}
      {sp.closed === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Finding closed after independent verification" /></div> : null}
      {sp.rejected === "1" ? <div className="mb-4"><AlertBanner tone="amber" title="Finding rejected with justification" /></div> : null}

      {finding.severity === "critical" && !["resolved", "rejected"].includes(finding.status) ? (
        <div className="mb-4"><AlertBanner tone="red" title="Critical finding — escalated to executive management">Immediate action is required. Closure requires independent auditor verification and Head of Audit approval.</AlertBanner></div>
      ) : null}
      {overdue ? <div className="mb-4"><AlertBanner tone="amber" title="Target completion date has passed">The action owner and responsible manager have been flagged for follow-up.</AlertBanner></div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <StatusBadge status={overdue ? "overdue" : finding.status} />
        <span className="badge bg-slate-50 text-slate-600 ring-slate-200">Risk score {finding.risk_score ?? "—"}</span>
        {finding.is_repeated ? <span className="badge bg-amber-50 text-amber-700 ring-amber-200">Repeated issue</span> : null}
        {finding.verified_at ? <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200"><ShieldCheck className="size-3" /> Verified</span> : null}
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Financial impact" value={formatMoney(finding.financial_impact_kobo, true)} tone="warning" />
        <KpiCard label="Target date" value={formatDate(finding.target_date)} tone={overdue ? "danger" : "default"} />
        <KpiCard label="Corrective actions" value={actions.length} hint={`${actions.filter((a) => ["verified", "closed"].includes(a.status)).length} verified`} />
        <KpiCard label="Evidence" value={evidence.length} hint="Documents in repository" />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Finding detail" description="Expected control, actual observation, root cause and recommendation.">
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <div><p className="eyebrow">Description</p><p className="mt-1 whitespace-pre-wrap">{finding.description}</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="eyebrow">Expected control</p><p className="mt-1 text-xs">{finding.expected_control ?? "—"}</p></div>
              <div><p className="eyebrow">Actual observation</p><p className="mt-1 text-xs">{finding.actual_observation ?? "—"}</p></div>
              <div><p className="eyebrow">Root cause</p><p className="mt-1 text-xs">{finding.root_cause ?? "—"}</p></div>
              <div><p className="eyebrow">Auditor recommendation</p><p className="mt-1 text-xs">{finding.recommendation ?? "—"}</p></div>
            </div>
            {sourceQuestion ? (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="eyebrow">Source checklist question</p>
                <p className="mt-1 text-xs text-slate-700">{sourceQuestion.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">Risk level: {sourceQuestion.risk_level} · {sourceQuestion.procedure ?? ""}</p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Accountability" description="Ownership and key dates.">
          <DetailList
            items={[
              { label: "Responsible officer", value: finding.responsible_name ?? "Unassigned" },
              { label: "Responsible email", value: finding.responsible_email ?? "—" },
              { label: "Raised by", value: finding.creator_name ?? "—" },
              { label: "Raised on", value: formatDateTime(finding.created_at) },
              { label: "Target date", value: formatDate(finding.target_date) },
              { label: "Verified by", value: finding.verifier_name ? `${finding.verifier_name} · ${formatDateTime(finding.verified_at)}` : "Pending" },
              { label: "Closed by", value: finding.closed_name ? `${finding.closed_name} · ${formatDateTime(finding.closed_at)}` : "—" },
              { label: "Linked audit", value: finding.audit_ref ? <Link href={`/audits/${finding.audit_id}`} className="link">{finding.audit_ref}</Link> : "—" },
            ]}
          />
          {finding.management_response ? (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
              <p className="eyebrow !text-blue-500">Management response</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">{finding.management_response}</p>
            </div>
          ) : null}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Corrective actions" description="Independent verification is required before closure.">
          <div className="space-y-2">
            {actions.map((action) => (
              <div key={action.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/actions/${action.id}`} className="text-xs font-medium text-slate-800 hover:underline">{action.description}</Link>
                    <p className="mt-1 text-[10px] text-slate-400">{action.ref} · {action.officer_name} · due {formatDate(action.due_date)}</p>
                  </div>
                  <StatusBadge status={isOverdue(action.due_date, action.status) ? "overdue" : action.status} />
                </div>
                <div className="mt-2"><Progress value={action.progress} /></div>
              </div>
            ))}
            {actions.length === 0 ? <p className="text-sm text-slate-500">No corrective actions yet.</p> : null}
          </div>

          {can(user, "actions.manage") ? (
            <form action={addCorrectiveActionFromFindingAction} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="findingId" value={finding.id} />
              <textarea name="description" required className="textarea min-h-16" placeholder="Corrective action description" />
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="officerId" required className="select"><option value="">Responsible officer</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name} · {titleCase(person.role)}</option>)}</select>
                <input name="dueDate" type="date" required className="input" defaultValue={DATE_PLUS_30} />
                <select name="department" className="select"><option value="">Department</option>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select>
                <SubmitButton className="btn-secondary">Add action</SubmitButton>
              </div>
            </form>
          ) : null}
        </Panel>

        <div className="space-y-4">
          {canRespond ? (
            <Panel title={finding.management_response ? "Update management response" : "Management response"} description="Management accepts or contests the finding and commits to remediation.">
              <form action={respondToFindingAction} className="space-y-2">
                <input type="hidden" name="findingId" value={finding.id} />
                <textarea name="managementResponse" required className="textarea" placeholder="Management response, acceptance and remediation commitment" defaultValue={finding.management_response ?? ""} />
                <SubmitButton className="btn-primary">Submit response</SubmitButton>
              </form>
            </Panel>
          ) : null}

          {canVerify ? (
            <Panel title="Independent verification" description={allActionsDone ? "All actions are verified. Record verification to progress closure." : "Actions must be completed and verified before this finding can be verified."}>
              <form action={verifyFindingAction} className="space-y-2">
                <input type="hidden" name="findingId" value={finding.id} />
                <textarea name="note" className="textarea min-h-16" placeholder="Verification note and evidence reviewed" />
                <SubmitButton className="btn-secondary">Verify remediation</SubmitButton>
              </form>
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-medium text-slate-500">Reject with justification</summary>
                <form action={rejectFindingAction} className="mt-2 space-y-2">
                  <input type="hidden" name="findingId" value={finding.id} />
                  <textarea name="justification" required className="textarea min-h-16" placeholder="Reason for rejection" />
                  <SubmitButton className="btn-danger btn-sm">Reject finding</SubmitButton>
                </form>
              </details>
            </Panel>
          ) : null}

          {canClose ? (
            <Panel title="Closure approval" description="Head of Audit approval is required to close a verified finding.">
              <form action={closeFindingAction}>
                <input type="hidden" name="findingId" value={finding.id} />
                <SubmitButton className="btn-primary"><CheckCircle2 className="size-4" /> Approve closure</SubmitButton>
              </form>
            </Panel>
          ) : null}

          <Panel title="Evidence" description="Documents linked to this finding.">
            <div className="space-y-2">
              {evidence.map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2"><FileText className="size-3.5 shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-700">{document.original_name}</p><p className="text-[9px] text-slate-400">{document.ref} · {document.uploaded_by_name ?? "—"}</p></div></div>
                  <a href={`/api/files/${document.id}`} target="_blank" className="text-[10px] font-semibold text-slate-500 hover:underline">View</a>
                </div>
              ))}
              {evidence.length === 0 ? <p className="text-xs text-slate-500">No evidence attached.</p> : null}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <EvidenceUpload findingId={finding.id} outletId={finding.outlet_id} category="remediation_evidence" label="Upload remediation evidence" />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Finding history" description="Every status change and approval is retained.">
          <ol className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <div>
                  <p className="text-[11px] font-medium text-slate-700">{titleCase(entry.action)} → {titleCase(entry.to_status ?? "")}</p>
                  {entry.note ? <p className="text-[10px] leading-4 text-slate-500">{entry.note}</p> : null}
                  <p className="text-[9px] text-slate-400">{entry.actor_name ?? "System"} · {formatDateTime(entry.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Escalations" description="Critical findings are escalated immediately.">
          {escalations.length ? (
            <ul className="space-y-2">
              {escalations.map((escalation) => (
                <li key={escalation.id} className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                  <p className="text-[11px] font-medium text-slate-800">{escalation.reason}</p>
                  <p className="text-[10px] text-slate-500">{escalation.level} · {formatDateTime(escalation.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="size-3.5" /> No escalations recorded for this finding.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
