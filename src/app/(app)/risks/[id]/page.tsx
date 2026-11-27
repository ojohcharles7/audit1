import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { RISK_EFFECTIVENESS } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateRiskAction } from "../actions";

export default async function RiskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("risks.view");
  const { id } = await params;
  const sp = await searchParams;
  const risk = await get<{ id: string; ref: string; title: string; category: string; description: string; cause: string | null; likelihood: number; impact: number; inherent_score: number; existing_controls: string | null; control_effectiveness: string; residual_score: number; rating: string; mitigation: string | null; review_date: string | null; status: string; owner_name: string | null; outlet_name: string | null }>(
    `SELECT r.*, u.name owner_name, o.name outlet_name FROM risks r LEFT JOIN users u ON u.id=r.owner_id LEFT JOIN outlets o ON o.id=r.outlet_id WHERE r.id=?`, [id]);
  if (!risk) notFound();
  const manual = can(user, "risks.manage");
  return (
    <div>
      <PageHeader eyebrow={`${risk.ref} · ${risk.category}`} title={risk.title} description={`${risk.outlet_name ?? "Enterprise-wide"} · owner ${risk.owner_name ?? "unassigned"}`} actions={<Link href="/risks" className="btn-secondary"><ArrowLeft className="size-4" /> Risk register</Link>} />
      {sp.updated === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Risk assessment updated" /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Inherent score" value={risk.inherent_score} hint={`${risk.likelihood} × ${risk.impact}`} />
        <KpiCard label="Residual score" value={risk.residual_score} tone={risk.rating === "critical" ? "danger" : "warning"} />
        <KpiCard label="Rating" value={titleCase(risk.rating)} tone={risk.rating === "critical" ? "danger" : "warning"} />
        <KpiCard label="Review date" value={formatDate(risk.review_date)} tone="info" />
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Risk detail">
          <div className="space-y-3 text-sm leading-6 text-slate-700"><div><p className="eyebrow">Description</p><p className="mt-1">{risk.description}</p></div><DetailList items={[{ label: "Cause", value: risk.cause ?? "—" }, { label: "Existing controls", value: risk.existing_controls ?? "—" }, { label: "Control effectiveness", value: titleCase(risk.control_effectiveness) }, { label: "Mitigation strategy", value: risk.mitigation ?? "—" }, { label: "Status", value: titleCase(risk.status) }, { label: "Outlet", value: risk.outlet_name ?? "Enterprise-wide" }]} /></div>
        </Panel>
        <Panel title="Assessment history" description="Risk scoring is recalculated on every update.">
          <div className="space-y-2 text-xs text-slate-500"><p>Inherent risk: <b className="text-slate-800">{risk.inherent_score}</b></p><p>Control effectiveness: <b className="text-slate-800">{titleCase(risk.control_effectiveness)}</b></p><p>Residual risk: <b className="text-slate-800">{risk.residual_score}</b> → <b className="text-slate-800">{titleCase(risk.rating)}</b></p><p className="pt-2 text-[10px] leading-4 text-slate-400">The residual score applies the configured control-effectiveness factor to the inherent score.</p></div>
        </Panel>
      </div>
      {manual ? (
        <div className="mt-4"><Panel title="Update assessment" description="Adjust likelihood, impact, controls and mitigation.">
          <form action={updateRiskAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="riskId" value={risk.id} />
            <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" defaultValue={risk.description} className="textarea" /></div>
            <div><label className="label">Likelihood</label><input name="likelihood" type="number" min="1" max="5" defaultValue={risk.likelihood} className="input" /></div>
            <div><label className="label">Impact</label><input name="impact" type="number" min="1" max="5" defaultValue={risk.impact} className="input" /></div>
            <div><label className="label">Control effectiveness</label><select name="effectiveness" defaultValue={risk.control_effectiveness} className="select">{RISK_EFFECTIVENESS.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}</select></div>
            <div><label className="label">Status</label><select name="status" defaultValue={risk.status} className="select"><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="closed">Closed</option><option value="escalated">Escalated</option></select></div>
            <div><label className="label">Existing controls</label><input name="existingControls" defaultValue={risk.existing_controls ?? ""} className="input" /></div>
            <div><label className="label">Review date</label><input name="reviewDate" type="date" defaultValue={risk.review_date ?? ""} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Mitigation strategy</label><textarea name="mitigation" defaultValue={risk.mitigation ?? ""} className="textarea min-h-16" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary">Save assessment</SubmitButton></div>
          </form>
        </Panel></div>
      ) : null}
    </div>
  );
}
