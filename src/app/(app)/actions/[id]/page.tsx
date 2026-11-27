import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { getAction } from "@/lib/data/actions";
import { formatDate, formatDateTime, isOverdue, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, Progress, SeverityBadge, StatusBadge } from "@/components/ui";
import { EvidenceUpload } from "@/components/evidence-upload";
import { SubmitButton } from "@/components/submit-button";
import { closeActionAction, updateActionAction, verifyActionAction } from "../actions";

export default async function ActionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("actions.view");
  const scope = await getScope(user);
  const { id } = await params;
  const sp = await searchParams;
  const data = await getAction(scope, id);
  if (!data) notFound();
  const { action, documents, findingHistory } = data;
  const overdue = isOverdue(action.due_date, action.status);

  return (
    <div>
      <PageHeader
        eyebrow={`${action.ref} · ${action.finding_ref}`}
        title={action.description}
        description={`${action.outlet_name} · ${action.officer_name} · due ${formatDate(action.due_date)}`}
        actions={<Link href="/actions" className="btn-secondary"><ArrowLeft className="size-4" /> All actions</Link>}
      />

      {sp.updated === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Action progress updated" /></div> : null}
      {sp.verified === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Action independently verified" /></div> : null}
      {sp.closed === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Action closed" /></div> : null}
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={overdue && !["verified", "closed"].includes(action.status) ? "overdue" : action.status} />
        <SeverityBadge severity={action.priority === "critical" ? "critical" : action.priority === "high" ? "high" : action.priority === "medium" ? "medium" : "low"} />
        {action.verified_at ? <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200"><ShieldCheck className="size-3" /> Verified {formatDate(action.verified_at)}</span> : null}
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Progress" value={`${action.progress}%`} tone={action.progress >= 100 ? "success" : "info"} />
        <KpiCard label="Due date" value={formatDate(action.due_date)} tone={overdue ? "danger" : "default"} />
        <KpiCard label="Finding severity" value={titleCase(action.finding_severity)} tone={action.finding_severity === "critical" ? "danger" : "warning"} />
        <KpiCard label="Evidence documents" value={documents.length} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title="Action detail" description="Corrective action scope and accountability.">
            <DetailList
              items={[
                { label: "Action reference", value: <span className="font-mono">{action.ref}</span> },
                { label: "Linked finding", value: <Link href={`/findings/${action.finding_id}`} className="link">{action.finding_ref} · {action.finding_title}</Link> },
                { label: "Responsible officer", value: `${action.officer_name} (${action.officer_email})` },
                { label: "Department", value: action.department ?? "—" },
                { label: "Priority", value: titleCase(action.priority) },
                { label: "Created", value: formatDateTime(action.created_at) },
                { label: "Verified by", value: action.verifier_name ? `${action.verifier_name} · ${formatDateTime(action.verified_at)}` : "Pending independent verification" },
                { label: "Closed by", value: action.closer_name ? `${action.closer_name} · ${formatDateTime(action.closed_at)}` : "—" },
              ]}
            />
            <div className="mt-4"><Progress value={action.progress} /></div>
            {action.management_comments ? <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="eyebrow">Latest update</p><p className="mt-1 text-xs text-slate-600">{action.management_comments}</p></div> : null}
            {action.verification_note ? <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="eyebrow !text-emerald-600">Verification note</p><p className="mt-1 text-xs text-slate-700">{action.verification_note}</p></div> : null}
          </Panel>

          <Panel title="Evidence" description="Supporting documents for this corrective action.">
            <div className="space-y-2">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2"><FileText className="size-3.5 shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-700">{document.original_name}</p><p className="text-[9px] text-slate-400">{document.ref} · {document.uploaded_by_name ?? "—"}</p></div></div>
                  <a href={`/api/files/${document.id}`} target="_blank" className="text-[10px] font-semibold text-slate-500 hover:underline">View</a>
                </div>
              ))}
              {documents.length === 0 ? <p className="text-xs text-slate-500">No evidence uploaded.</p> : null}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <EvidenceUpload actionId={action.id} outletId={action.outlet_id} category="action_evidence" label="Upload action evidence" />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {can(user, "actions.manage") && !["verified", "closed"].includes(action.status) ? (
            <Panel title="Update progress" description="Progress updates notify the verification team.">
              <form action={updateActionAction} className="space-y-3">
                <input type="hidden" name="actionId" value={action.id} />
                <div><label className="label">Progress (%)</label><input name="progress" type="number" min="0" max="100" defaultValue={action.progress} className="input" /></div>
                <div><label className="label">Management comments</label><textarea name="comments" className="textarea min-h-16" placeholder="What has been done and what remains" defaultValue={action.management_comments ?? ""} /></div>
                <SubmitButton className="btn-primary">Save progress</SubmitButton>
              </form>
            </Panel>
          ) : null}

          {can(user, "actions.verify") && !["verified", "closed"].includes(action.status) ? (
            <Panel title="Independent verification" description="Verify only after reviewing the evidence and testing the action.">
              <form action={verifyActionAction} className="space-y-2">
                <input type="hidden" name="actionId" value={action.id} />
                <textarea name="note" required className="textarea min-h-16" placeholder="Verification note" />
                <SubmitButton className="btn-secondary">Verify action</SubmitButton>
              </form>
            </Panel>
          ) : null}

          {can(user, "actions.close") && action.status === "verified" ? (
            <Panel title="Close action" description="Closure is recorded with approval history.">
              <form action={closeActionAction}>
                <input type="hidden" name="actionId" value={action.id} />
                <SubmitButton className="btn-primary"><CheckCircle2 className="size-4" /> Close action</SubmitButton>
              </form>
            </Panel>
          ) : null}

          <Panel title="Finding history" description="Related finding timeline.">
            <ol className="space-y-3">
              {findingHistory.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-300" />
                  <div>
                    <p className="text-[10px] font-medium text-slate-700">{titleCase(entry.action)} → {titleCase(entry.to_status ?? "")}</p>
                    <p className="text-[9px] text-slate-400">{entry.actor_name ?? "System"} · {formatDateTime(entry.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
