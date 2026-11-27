import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, FileText, MapPin, ShieldAlert, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { outletDetail } from "@/lib/data/outlets";
import { categoryLabel } from "@/lib/constants";
import { formatDate, formatMoney, percent, titleCase } from "@/lib/format";
import { DetailList, KpiCard, PageHeader, Panel, Progress, Score, SeverityBadge, StatusBadge } from "@/components/ui";

export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("outlets.view");
  const scope = await getScope(user);
  const { id } = await params;
  const data = await outletDetail(scope, id);
  if (!data) notFound();
  const { outlet, audits, findings, actions, risks, documents, categoryScores, counts } = data;
  const latestAudit = audits.find((a) => ["approved", "closed", "submitted"].includes(a.status));

  return (
    <div>
      <PageHeader
        eyebrow={`${outlet.code} · ${outlet.region_name} region`}
        title={outlet.name}
        description={`${outlet.address} · Manager: ${outlet.manager_name ?? "Unassigned"} · ${outlet.employee_count} employees`}
        actions={
          <>
            <Link href="/outlets" className="btn-secondary">
              <ArrowLeft className="size-4" /> All outlets
            </Link>
            <Link href={`/planning?outlet=${outlet.id}`} className="btn-primary">
              <CalendarClock className="size-4" /> Schedule audit
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={`badge ${outlet.risk_rating === "critical" ? "bg-red-600 text-white ring-red-600" : outlet.risk_rating === "high" ? "bg-orange-500 text-white ring-orange-500" : outlet.risk_rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>
          <ShieldAlert className="size-3" /> {titleCase(outlet.risk_rating)} risk
        </span>
        <StatusBadge status={outlet.compliance_status} />
        <span className="badge bg-slate-50 text-slate-600 ring-slate-200">
          <MapPin className="size-3" /> {outlet.state_name}
        </span>
        <span className="badge bg-slate-50 text-slate-600 ring-slate-200">
          <Users className="size-3" /> {outlet.employee_count} staff
        </span>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Latest audit score" value={outlet.last_audit_score != null ? <Score value={outlet.last_audit_score} /> : "—"} hint={formatDate(outlet.last_audit_at)} />
        <KpiCard label="Open findings" value={counts?.open_findings ?? 0} tone="danger" hint={`${counts?.critical_findings ?? 0} critical`} />
        <KpiCard label="Financial exposure" value={formatMoney(counts?.exposure ?? 0, true)} tone="warning" />
        <KpiCard label="Open actions" value={counts?.open_actions ?? 0} tone="info" />
        <KpiCard label="Audits on record" value={counts?.audit_count ?? 0} hint={`${counts?.resolved_findings ?? 0} resolved findings`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Latest audit score by category" description={latestAudit ? `${latestAudit.ref} · ${latestAudit.title}` : "No completed audit on record."}>
          {categoryScores.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {categoryScores.map((row) => {
                const value = row.weight ? Math.round((row.earned / row.weight) * 1000) / 10 : 0;
                return (
                  <div key={row.category}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{categoryLabel(row.category)}</span>
                      <span className="font-semibold text-slate-900">{percent(value, 1)}</span>
                    </div>
                    <Progress value={value} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Category scores appear after the outlet&apos;s first submitted audit.</p>
          )}
        </Panel>

        <Panel title="Outlet profile" description="Static outlet and management information.">
          <DetailList
            items={[
              { label: "Outlet code", value: <span className="font-mono">{outlet.code}</span> },
              { label: "Region", value: outlet.region_name },
              { label: "State", value: outlet.state_name },
              { label: "Outlet manager", value: outlet.manager_name ?? "Unassigned" },
              { label: "Assistant manager", value: outlet.assistant_manager ?? "—" },
              { label: "Employees", value: outlet.employee_count },
              { label: "Phone", value: outlet.phone ?? "—" },
              { label: "Opened", value: formatDate(outlet.opened_at) },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Audit history"
          description="Recent audits at this outlet."
          action={<Link href={`/audits?outlet=${outlet.id}`} className="text-xs font-semibold text-slate-500 hover:text-slate-900">View all →</Link>}
        >
          <div className="table-wrap">
            <table className="table min-w-[520px]">
              <thead><tr><th>Audit</th><th>Status</th><th>Score</th><th>Date</th></tr></thead>
              <tbody>
                {audits.slice(0, 6).map((audit) => (
                  <tr key={audit.id}>
                    <td>
                      <Link href={`/audits/${audit.id}`} className="font-medium text-slate-800 hover:underline">{audit.title}</Link>
                      <p className="text-[10px] font-mono text-slate-400">{audit.ref}</p>
                    </td>
                    <td><StatusBadge status={audit.status} /></td>
                    <td><Score value={audit.score} /></td>
                    <td className="text-xs text-slate-500">{formatDate(audit.planned_date)}</td>
                  </tr>
                ))}
                {audits.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">No audits yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Findings"
          description="Open and resolved exceptions at this outlet."
          action={<Link href={`/findings?outlet=${outlet.id}`} className="text-xs font-semibold text-slate-500 hover:text-slate-900">View all →</Link>}
        >
          <ul className="divide-y divide-slate-100">
            {findings.slice(0, 6).map((finding) => (
              <li key={finding.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/findings/${finding.id}`} className="line-clamp-2 text-sm font-medium text-slate-800 hover:underline">{finding.title}</Link>
                    <p className="mt-1 text-[10px] text-slate-400"><span className="font-mono">{finding.ref}</span> · {formatDate(finding.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <SeverityBadge severity={finding.severity} />
                    <div className="mt-1"><StatusBadge status={finding.status} /></div>
                  </div>
                </div>
              </li>
            ))}
            {findings.length === 0 ? <li className="py-6 text-center text-sm text-slate-500">No findings recorded.</li> : null}
          </ul>
        </Panel>

        <Panel title="Corrective actions" description="Remediation for this outlet, ordered by due date.">
          <div className="space-y-2.5">
            {actions.slice(0, 5).map((action) => (
              <div key={action.id} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/actions/${action.id}`} className="line-clamp-2 text-xs font-medium text-slate-800 hover:underline">{action.description}</Link>
                    <p className="mt-1 text-[10px] text-slate-400">{action.ref} · {action.officer_name} · due {formatDate(action.due_date)}</p>
                  </div>
                  <StatusBadge status={action.status} />
                </div>
                <div className="mt-2"><Progress value={action.progress} /></div>
              </div>
            ))}
            {actions.length === 0 ? <p className="text-sm text-slate-500">No corrective actions.</p> : null}
          </div>
        </Panel>

        <Panel title="Risk register" description="Risks linked to this outlet.">
          <ul className="divide-y divide-slate-100">
            {risks.map((risk) => (
              <li key={risk.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800">{risk.title}</p>
                  <p className="text-[10px] text-slate-400">{risk.category} · residual {risk.residual_score}</p>
                </div>
                <span className={`badge ${risk.rating === "critical" ? "bg-red-600 text-white ring-red-600" : risk.rating === "high" ? "bg-orange-500 text-white ring-orange-500" : risk.rating === "medium" ? "bg-amber-300 text-amber-950 ring-amber-300" : "bg-emerald-500 text-white ring-emerald-500"}`}>{titleCase(risk.rating)}</span>
              </li>
            ))}
            {risks.length === 0 ? <li className="py-4 text-sm text-slate-500">No outlet-specific risks.</li> : null}
          </ul>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Evidence library" description="Documents linked to this outlet and its audits.">
          <div className="table-wrap">
            <table className="table min-w-[640px]">
              <thead><tr><th>Document</th><th>Category</th><th>Uploaded by</th><th>Date</th><th /></tr></thead>
              <tbody>
                {documents.slice(0, 8).map((document) => (
                  <tr key={document.id}>
                    <td>
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-800"><FileText className="size-3.5 text-slate-400" /> {document.original_name}</span>
                      <p className="text-[10px] font-mono text-slate-400">{document.ref}</p>
                    </td>
                    <td className="text-xs">{titleCase(document.category)}</td>
                    <td className="text-xs">{document.uploaded_by_name ?? "—"}</td>
                    <td className="text-xs text-slate-500">{formatDate(document.created_at)}</td>
                    <td className="text-right"><a href={`/api/files/${document.id}`} className="btn-secondary btn-sm"><Download className="size-3" /> Download</a></td>
                  </tr>
                ))}
                {documents.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">No evidence uploaded.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
