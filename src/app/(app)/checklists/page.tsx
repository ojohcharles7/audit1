import Link from "next/link";
import { ClipboardList, Layers3, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { all } from "@/db";
import { AUDIT_CATEGORIES, categoryLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createTemplateAction } from "./actions";

export const metadata = { title: "Audit checklists" };

export default async function ChecklistsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("checklists.view");
  const sp = await searchParams;
  const templates = await all<{ id: string; code: string; name: string; category: string; version: number; description: string | null; active: number; created_at: string; question_count: number; weight: number }>(
    `SELECT t.*, count(q.id) question_count, coalesce(sum(q.weight),0) weight FROM audit_templates t LEFT JOIN checklist_questions q ON q.template_id=t.id AND q.active=1 GROUP BY t.id ORDER BY t.category`,
  );
  const totalQuestions = templates.reduce((sum, template) => sum + template.question_count, 0);

  return (
    <div>
      <PageHeader eyebrow="Digital checklist engine" title="Audit checklists" description="Configurable templates, weighted scoring, mandatory evidence and control objectives for every audit discipline." />
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Templates" value={templates.length} icon={<Layers3 className="size-4" />} />
        <KpiCard label="Active" value={templates.filter((t) => t.active).length} tone="success" />
        <KpiCard label="Questions" value={totalQuestions} icon={<ClipboardList className="size-4" />} />
        <KpiCard label="Scoring" value="Weighted" hint="Configurable by Head of Audit" tone="info" />
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="eyebrow">{categoryLabel(template.category)}</p><Link href={`/checklists/${template.id}`} className="mt-1 block text-sm font-semibold text-slate-800 hover:underline">{template.name}</Link></div>
              <StatusBadge status={template.active ? "active" : "inactive"} />
            </div>
            <p className="mt-2 line-clamp-2 flex-1 text-xs leading-5 text-slate-500">{template.description}</p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
              <span className="font-mono">{template.code}</span><span>{template.question_count} questions · v{template.version}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Updated {formatDate(template.created_at)}</span>
              <Link href={`/checklists/${template.id}`} className="text-[11px] font-semibold text-slate-600 hover:underline">Open builder →</Link>
            </div>
          </div>
        ))}
      </div>
      {can(user, "checklists.manage") ? (
        <div className="mt-4">
          <Panel title="Create a template" description="Start a new custom audit checklist. You can add weighted questions immediately.">
            <form action={createTemplateAction} className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Template name</label><input name="name" required className="input" placeholder="e.g. Cash Handling Deep Dive" /></div>
              <div><label className="label">Category</label><select name="category" className="select">{AUDIT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" className="textarea min-h-16" /></div>
              <div className="sm:col-span-2"><SubmitButton className="btn-primary"><Plus className="size-4" /> Create template</SubmitButton></div>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
