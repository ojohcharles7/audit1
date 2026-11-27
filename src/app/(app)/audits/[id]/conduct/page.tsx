import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { getScope, canConductAudit } from "@/lib/scope";
import { auditDetail } from "@/lib/data/audits";
import { AlertBanner, PageHeader } from "@/components/ui";
import { ChecklistForm } from "@/components/checklist-form";

export const metadata = { title: "Conduct audit" };

export default async function ConductAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("audits.conduct");
  const scope = await getScope(user);
  const { id } = await params;
  const data = await auditDetail(scope, id);
  if (!data) notFound();
  const { audit, questions, responses, documents, responseDocuments } = data;
  if (audit.locked_at || ["submitted", "approved", "closed", "cancelled"].includes(audit.status)) {
    redirect(`/audits/${id}?error=This+audit+is+locked+and+cannot+be+edited`);
  }
  if (!canConductAudit(user, audit)) {
    redirect(`/audits/${id}?error=You+are+not+assigned+to+conduct+this+audit`);
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${audit.ref} · ${audit.template_name}`}
        title="Conduct outlet audit"
        description={`${audit.outlet_name} · ${audit.auditor_name} · due ${new Date(audit.due_date).toLocaleDateString("en-NG")}`}
        actions={<Link href={`/audits/${audit.id}`} className="btn-secondary"><ArrowLeft className="size-4" /> Audit overview</Link>}
      />

      {audit.status === "scheduled" ? (
        <div className="mb-4">
          <AlertBanner tone="blue" title="Fieldwork not yet started">
            Your first saved response will start the audit and set its status to in progress.
          </AlertBanner>
        </div>
      ) : null}

      <ChecklistForm
        audit={{ id: audit.id, ref: audit.ref, title: audit.title, status: audit.status, template_name: audit.template_name }}
        questions={questions}
        responses={responses}
        documents={documents}
        responseDocuments={responseDocuments}
      />

      <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400">
        <Lock className="size-3" /> Submitted audits are locked. Evidence is stored in the secure repository with an access trail.
      </p>
    </div>
  );
}
