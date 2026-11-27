import Link from "next/link";
import { DATE_PLUS_30 } from "@/lib/defaults";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Lock,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { canConductAudit } from "@/lib/scope";
import { auditDetail } from "@/lib/data/audits";
import { AUDIT_CATEGORIES, AUDIT_TYPES, SEVERITIES, categoryLabel } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, percent, titleCase } from "@/lib/format";
import { calculateAuditScore } from "@/lib/scoring";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel, Progress, Score, SeverityBadge, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { approveAuditAction, addAuditFindingAction, generateAuditReportAction } from "../actions";

export default async function AuditDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("audits.view");
  const scope = await getScope(user);
  const { id } = await params;
  const sp = await searchParams;
  const data = await auditDetail(scope, id);
  if (!data) notFound();
  const { audit, questions, responses, breakdown, findings, evidence, report, logs } = data;
  const canEdit = canConductAudit(user, audit) && ["scheduled", "in_progress"].includes(audit.status);
  const canApprove = can(user, "audits.approve") && ["submitted", "under_review"].includes(audit.status);
  const responseMap = new Map(responses.map((response) => [response.question_id, response]));
  const sections = [...new Set(questions.map((question) => question.section))];
  const categoryRows = AUDIT_CATEGORIES.map((category) => {
    const categoryQuestions = questions.filter((q) => q.category === category.id);
    const categoryResponses = categoryQuestions.map((q) => responseMap.get(q.id)).filter(Boolean) as typeof responses;
    const scored = calculateAuditScore(categoryQuestions, categoryResponses);
    return { ...category, score: scored.score, issues: scored.issues.length };
  }).filter((row) => row.score > 0 || questions.some((q) => q.category === row.id));
  const financial = findings.reduce((sum, finding) => sum + finding.financial_impact_kobo, 0);
  const totalDocuments = evidence.length;

  return (
    <div>
      <PageHeader
        eyebrow={`${audit.ref} · ${categoryLabel(audit.category)}`}
        title={audit.title}
        description={`${audit.outlet_name} · ${audit.state_name} · ${audit.region_name} region · Conducted by ${audit.auditor_name}`}
        actions={
          <>
            <Link href="/audits" className="btn-secondary"><ArrowLeft className="size-4" /> All audits</Link>
            {canEdit ? <Link href={`/audits/${audit.id}/conduct`} className="btn-primary"><ClipboardCheck className="size-4" /> Conduct audit</Link> : null}
            {canApprove ? (
              <form action={approveAuditAction}>
                <input type="hidden" name="auditId" value={audit.id} />
                <SubmitButton className="btn-primary"><CheckCircle2 className="size-4" /> Approve</SubmitButton>
              </form>
            ) : null}
            {can(user, "reports.generate") && ["approved", "closed"].includes(audit.status) ? (
              <form action={generateAuditReportAction}>
                <input type="hidden" name="auditId" value={audit.id} />
                <SubmitButton className="btn-secondary"><FileText className="size-4" /> Generate report</SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      {sp.submitted === "1" ? <AlertBanner tone="green" title="Audit submitted and locked">The audit was submitted for review. Critical findings were escalated automatically.</AlertBanner> : null}
      {sp.approved === "1" ? <AlertBanner tone="green" title="Audit approved">The report has been approved and is available in the reporting centre.</AlertBanner> : null}
      {typeof sp.error === "string" ? <AlertBanner tone="red" title={sp.error} /> : null}

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={audit.status} />
        <span className="badge bg-slate-50 text-slate-600 ring-slate-200">{AUDIT_TYPES.find((type) => type.id === audit.audit_type)?.label ?? titleCase(audit.audit_type)}</span>
        {audit.locked_at ? <span className="badge bg-slate-900 text-white ring-slate-900"><Lock className="size-3" /> Locked {formatDateTime(audit.locked_at)}</span> : null}
        {audit.risk_rating ? <span className={`badge ${audit.risk_rating === "critical" ? "bg-red-600 text-white ring-red-600" : audit.risk_rating === "high" ? "bg-orange-500 text-white ring-orange-500" : audit.risk_rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>{titleCase(audit.risk_rating)} risk</span> : null}
        {report ? <Link href={`/reports/${report.id}`} className="badge bg-blue-50 text-blue-700 ring-blue-200"><FileText className="size-3" /> {report.report_ref}</Link> : null}
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Overall score" value={audit.score != null ? <Score value={audit.score} /> : "—"} hint={audit.compliance_rate != null ? `${percent(audit.compliance_rate, 1)} compliance` : undefined} />
        <KpiCard label="Findings" value={findings.length} tone="warning" hint={`${findings.filter((f) => f.severity === "critical").length} critical`} />
        <KpiCard label="Financial exposure" value={formatMoney(financial, true)} tone="danger" />
        <KpiCard label="Evidence documents" value={totalDocuments} />
        <KpiCard label="Responses" value={`${breakdown.answered}/${breakdown.total}`} hint={`${breakdown.issues.filter((i) => i.reason === "unanswered" || i.reason === "evidence").length} outstanding`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Audit information" description="Reference, period, scope and approval details.">
          <DetailList
            items={[
              { label: "Audit reference", value: <span className="font-mono">{audit.ref}</span> },
              { label: "Outlet", value: <Link href={`/outlets/${audit.outlet_id}`} className="link">{audit.outlet_name} ({audit.outlet_code})</Link> },
              { label: "Auditor", value: audit.auditor_name },
              { label: "Audit manager", value: audit.manager_name ?? "—" },
              { label: "Planned date", value: formatDate(audit.planned_date) },
              { label: "Due date", value: formatDate(audit.due_date) },
              { label: "Submitted", value: formatDateTime(audit.submitted_at) },
              { label: "Approved", value: audit.approved_name ? `${audit.approved_name} · ${formatDateTime(audit.approved_at)}` : "—" },
              { label: "Objectives", value: audit.objectives ?? "—" },
              { label: "Scope", value: audit.scope ?? "—" },
              { label: "Methodology", value: audit.methodology ?? "—" },
              { label: "Template", value: audit.template_name },
            ]}
          />
        </Panel>

        <Panel title="Category performance" description="Weighted score for each control category in this audit.">
          <div className="space-y-3">
            {categoryRows.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">{row.short}</span>
                  <span className="font-semibold text-slate-900">{percent(row.score, 1)}</span>
                </div>
                <Progress value={row.score} />
              </div>
            ))}
            <p className="pt-2 text-[10px] leading-4 text-slate-400">Scoring is weighted by question importance and excludes not-applicable controls.</p>
          </div>
        </Panel>
      </div>

      {findings.length ? (
        <div className="mt-4">
          <Panel title="Findings raised from this audit" description="Each finding is tracked through management response, corrective action and independent verification.">
            <div className="table-wrap">
              <table className="table min-w-[760px]">
                <thead><tr><th>Reference</th><th>Finding</th><th>Severity</th><th>Status</th><th>Impact</th><th>Target</th></tr></thead>
                <tbody>
                  {findings.map((finding) => (
                    <tr key={finding.id}>
                      <td><Link href={`/findings/${finding.id}`} className="font-mono text-xs text-slate-700 hover:underline">{finding.ref}</Link></td>
                      <td><Link href={`/findings/${finding.id}`} className="text-xs font-medium text-slate-800 hover:underline">{finding.title}</Link></td>
                      <td><SeverityBadge severity={finding.severity} /></td>
                      <td><StatusBadge status={finding.status} /></td>
                      <td className="text-xs tabular-nums">{formatMoney(finding.financial_impact_kobo, true)}</td>
                      <td className="text-xs">{formatDate(finding.target_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="mt-4">
        <Panel title="Checklist responses" description={`${breakdown.answered} of ${breakdown.total} questions answered. Grouped by audit section.`}>
          <div className="space-y-2">
            {sections.map((section) => {
              const sectionQuestions = questions.filter((q) => q.section === section);
              const answeredCount = sectionQuestions.filter((q) => responseMap.get(q.id)?.result || responseMap.get(q.id)?.numeric_value != null || responseMap.get(q.id)?.text_value || responseMap.get(q.id)?.amount_kobo != null).length;
              return (
                <details key={section} className="rounded-lg border border-slate-200 bg-white" open={sectionQuestions.some((q) => responseMap.get(q.id)?.result === "noncompliant")}>
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold text-slate-700">
                    <span>{section}</span>
                    <span className="text-[10px] font-normal text-slate-400">{answeredCount}/{sectionQuestions.length}</span>
                  </summary>
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {sectionQuestions.map((question) => {
                      const response = responseMap.get(question.id);
                      return (
                        <div key={question.id} className="px-3 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium leading-5 text-slate-700"><span className="mr-1 font-mono text-[9px] text-slate-400">{question.code}</span>{question.text}</p>
                              {response?.comment ? <p className="mt-1 text-[10px] leading-4 text-slate-500">Auditor: {response.comment}</p> : null}
                              {response?.text_value ? <p className="mt-1 text-[10px] text-slate-500">{response.text_value}</p> : null}
                              {response?.numeric_value != null ? <p className="mt-1 text-[10px] text-slate-500">Numeric: {response.numeric_value}</p> : null}
                              {response?.amount_kobo ? <p className="mt-1 text-[10px] text-slate-500">Amount: {formatMoney(response.amount_kobo)}</p> : null}
                              {response?.document_count ? <p className="mt-1 text-[10px] text-slate-400">{response.document_count} evidence document(s)</p> : null}
                            </div>
                            <div className="shrink-0">
                              {response?.result ? <StatusBadge status={response.result} label={titleCase(response.result)} /> : <span className="badge bg-slate-50 text-slate-400 ring-slate-200">Unanswered</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Audit evidence" description={`${evidence.length} document(s) uploaded to this audit.`}>
          <div className="space-y-2">
            {evidence.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">{document.original_name}</p>
                    <p className="text-[10px] text-slate-400">{document.ref} · {titleCase(document.category)} · {formatDate(document.created_at)}</p>
                  </div>
                </div>
                <a href={`/api/files/${document.id}?download=1`} className="btn-secondary btn-sm"><Download className="size-3" /> Open</a>
              </div>
            ))}
            {evidence.length === 0 ? <p className="text-sm text-slate-500">No evidence documents uploaded.</p> : null}
          </div>
        </Panel>

        <Panel title="Audit trail" description="Append-only record of activity on this audit.">
          <ol className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <div>
                  <p className="text-[11px] font-medium text-slate-700">{log.summary}</p>
                  <p className="text-[10px] text-slate-400">{log.actor_name ?? "System"} · {formatDateTime(log.created_at)}</p>
                </div>
              </li>
            ))}
            {logs.length === 0 ? <li className="text-sm text-slate-500">No activity recorded yet.</li> : null}
          </ol>
        </Panel>
      </div>

      {can(user, "findings.create") ? (
        <div className="mt-4">
          <Panel title="Raise an additional finding" description="Document an observation not captured automatically by the checklist.">
            <form action={addAuditFindingAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="auditId" value={audit.id} />
              <div><label className="label">Title</label><input name="title" required className="input" placeholder="Short finding title" /></div>
              <div><label className="label">Category</label><select name="category" className="select" defaultValue={audit.category}>{AUDIT_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div>
              <div><label className="label">Severity</label><select name="severity" className="select" defaultValue="medium">{SEVERITIES.map((severity) => <option key={severity.id} value={severity.id}>{severity.label}</option>)}</select></div>
              <div><label className="label">Financial impact (₦)</label><input name="financialImpact" type="number" min="0" step="0.01" defaultValue="0" className="input" /></div>
              <div><label className="label">Target date</label><input name="targetDate" type="date" required defaultValue={DATE_PLUS_30} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" required className="textarea" placeholder="What was observed and why it matters" /></div>
              <div><label className="label">Expected control</label><input name="expectedControl" className="input" placeholder="What should have happened" /></div>
              <div><label className="label">Actual observation</label><input name="actualObservation" className="input" placeholder="What actually happened" /></div>
              <div><label className="label">Root cause</label><input name="rootCause" className="input" /></div>
              <div><label className="label">Recommendation</label><input name="recommendation" className="input" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary">Create finding</SubmitButton></div>
            </form>
          </Panel>
        </div>
      ) : null}

      <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400"><ShieldAlert className="size-3" /> Submitted audits are immutable. Any correction must be recorded as an amendment. <Printer className="ml-2 size-3" /> <Link href={report ? `/reports/${report.id}/print` : "#"} className="hover:underline">Print report</Link></p>
    </div>
  );
}
