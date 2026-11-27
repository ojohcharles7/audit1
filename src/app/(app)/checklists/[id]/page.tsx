import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { all, get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { categoryLabel } from "@/lib/constants";
import { titleCase } from "@/lib/format";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { addQuestionAction, toggleTemplateAction } from "../actions";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("checklists.view");
  const { id } = await params;
  const template = get<{ id: string; code: string; name: string; category: string; version: number; description: string | null; active: number }>("SELECT * FROM audit_templates WHERE id=?", [id]);
  if (!template) notFound();
  const questions = all<{ id: string; section: string; code: string; text: string; control_objective: string | null; response_type: string; risk_level: string; evidence_required: string; weight: number; mandatory: number }>(
    "SELECT * FROM checklist_questions WHERE template_id=? AND active=1 ORDER BY sort_order",
    [id],
  );
  const sections = [...new Set(questions.map((q) => q.section))];
  const editable = can(user, "checklists.manage");

  return (
    <div>
      <PageHeader eyebrow={`${template.code} · ${categoryLabel(template.category)} · v${template.version}`} title={template.name} description={template.description ?? undefined} actions={<><Link href="/checklists" className="btn-secondary"><ArrowLeft className="size-4" /> Templates</Link>{editable ? <form action={toggleTemplateAction}><input type="hidden" name="templateId" value={template.id} /><SubmitButton className="btn-secondary">{template.active ? "Deactivate" : "Activate"}</SubmitButton></form> : null}</>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={template.active ? "active" : "inactive"} /><span className="badge bg-slate-50 text-slate-600 ring-slate-200">{questions.length} questions</span><span className="badge bg-slate-50 text-slate-600 ring-slate-200">{questions.reduce((sum, q) => sum + q.weight, 0)} total weight</span><span className="badge bg-slate-50 text-slate-600 ring-slate-200">{questions.filter((q) => q.evidence_required !== "none").length} evidence checks</span></div>
      <Panel title="Checklist questions" description="Questions are scored by weight. Not-applicable responses are excluded from the denominator.">
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section}>
              <p className="mb-1 text-[11px] font-semibold text-slate-500">{section}</p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {questions.filter((q) => q.section === section).map((question) => (
                  <div key={question.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1"><p className="text-[11px] font-medium leading-5 text-slate-700"><span className="mr-1 font-mono text-[9px] text-slate-400">{question.code}</span>{question.text}</p><p className="mt-0.5 text-[10px] text-slate-400">{question.control_objective}</p></div>
                    <div className="flex shrink-0 items-center gap-1"><span className="badge bg-slate-50 text-slate-500 ring-slate-200">{titleCase(question.response_type)}</span><span className={question.risk_level === "critical" ? "badge bg-red-600 text-white ring-red-600" : "badge bg-slate-50 text-slate-500 ring-slate-200"}>{question.risk_level}</span><span className="badge bg-slate-50 text-slate-500 ring-slate-200">W{question.weight}</span>{question.evidence_required !== "none" ? <span className="badge bg-amber-50 text-amber-700 ring-amber-200">{question.evidence_required}</span> : null}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 ? <p className="text-sm text-slate-500">No questions yet.</p> : null}
        </div>
      </Panel>
      {editable ? (
        <div className="mt-4">
          <Panel title="Add a question" description="Every question requires a category, risk level, weight and response type.">
            <form action={addQuestionAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="templateId" value={template.id} />
              <div><label className="label">Section</label><input name="section" required className="input" placeholder="Cash reconciliation" /></div>
              <div><label className="label">Risk level</label><select name="risk" className="select" defaultValue="medium"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
              <div className="sm:col-span-2"><label className="label">Question</label><textarea name="text" required className="textarea min-h-16" /></div>
              <div><label className="label">Control objective</label><input name="objective" className="input" /></div>
              <div><label className="label">Audit procedure</label><input name="procedure" className="input" /></div>
              <div><label className="label">Response type</label><select name="responseType" className="select"><option value="compliance">Compliance</option><option value="yes_no">Yes / No</option><option value="numeric">Numeric</option><option value="financial">Financial amount</option><option value="text">Text</option><option value="date">Date</option></select></div>
              <div><label className="label">Evidence</label><select name="evidence" className="select"><option value="none">None</option><option value="photo">Photo required</option><option value="document">Document required</option><option value="both">Photo or document</option></select></div>
              <div><label className="label">Scoring weight</label><input name="weight" type="number" min="1" max="10" defaultValue="2" className="input" /></div>
              <div><label className="label">Expected control</label><input name="expected" className="input" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary"><Plus className="size-4" /> Add question</SubmitButton></div>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
