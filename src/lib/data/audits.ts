import { all, get } from "@/db";
import type { Scope } from "@/lib/scope";
import { canAccessAudit, outletScopeSql } from "@/lib/scope";
import type { AuditRow, DocumentRow, FindingRow, QuestionRow, ReportRow, ResponseRow } from "@/lib/types";
import type { ListFilters } from "./common";
import { whereAudits } from "./common";
import { calculateAuditScore } from "@/lib/scoring";

export async function listAudits(scope: Scope, filters: Partial<ListFilters>, limit = 200) {
  const where = whereAudits(scope, filters);
  return await all<
    AuditRow & {
      outlet_name: string;
      outlet_code: string;
      region_name: string;
      auditor_name: string;
      template_name: string;
      open_findings: number;
    }
  >(
    `SELECT a.*, o.name outlet_name, o.code outlet_code, r.name region_name, u.name auditor_name, t.name template_name,
      (SELECT count(*) FROM findings f WHERE f.audit_id = a.id AND f.status NOT IN ('resolved','rejected')) open_findings
     FROM audits a JOIN outlets o ON o.id = a.outlet_id JOIN regions r ON r.id = o.region_id
     JOIN users u ON u.id = a.auditor_id JOIN audit_templates t ON t.id = a.template_id
     WHERE ${where.sql} ORDER BY CASE a.status WHEN 'in_progress' THEN 0 WHEN 'submitted' THEN 1 WHEN 'under_review' THEN 2 WHEN 'overdue' THEN 3 ELSE 4 END, a.planned_date DESC LIMIT ?`,
    [...where.params, limit],
  );
}

export async function auditStats(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  const row = await get<{
    total: number;
    scheduled: number;
    in_progress: number;
    completed: number;
    overdue: number;
    avg_score: number;
  }>(
    `SELECT count(*) total,
      coalesce(sum(CASE WHEN a.status='scheduled' THEN 1 ELSE 0 END),0) scheduled,
      coalesce(sum(CASE WHEN a.status='in_progress' THEN 1 ELSE 0 END),0) in_progress,
      coalesce(sum(CASE WHEN a.status IN ('approved','closed') THEN 1 ELSE 0 END),0) completed,
      coalesce(sum(CASE WHEN a.status='overdue' OR (a.status IN ('scheduled','in_progress') AND a.due_date < to_char(CURRENT_DATE,'YYYY-MM-DD')) THEN 1 ELSE 0 END),0) overdue,
      coalesce(round(avg(CASE WHEN a.status IN ('approved','closed') THEN a.score END)::numeric,1),0) avg_score
     FROM audits a JOIN outlets o ON o.id=a.outlet_id WHERE ${scopeSql.sql}`,
    scopeSql.params,
  );
  return row ?? { total: 0, scheduled: 0, in_progress: 0, completed: 0, overdue: 0, avg_score: 0 };
}

export async function getAudit(scope: Scope, id: string) {
  if (!(await canAccessAudit(scope, id))) return null;
  return (
    await get<
      AuditRow & {
        outlet_name: string;
        outlet_code: string;
        outlet_address: string;
        state_name: string;
        region_name: string;
        auditor_name: string;
        auditor_email: string;
        manager_name: string | null;
        approved_name: string | null;
        template_name: string;
        template_code: string;
      }
    >(
      `SELECT a.*, o.name outlet_name, o.code outlet_code, o.address outlet_address, s.name state_name, r.name region_name,
        u.name auditor_name, u.email auditor_email, m.name manager_name, ap.name approved_name,
        t.name template_name, t.code template_code
       FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN states s ON s.id=o.state_id JOIN regions r ON r.id=o.region_id
       JOIN users u ON u.id=a.auditor_id LEFT JOIN users m ON m.id=a.manager_id LEFT JOIN users ap ON ap.id=a.approved_by
       JOIN audit_templates t ON t.id=a.template_id WHERE a.id = ?`,
      [id],
    ) ?? null
  );
}

export async function auditQuestions(audit: AuditRow) {
  const questions = await all<QuestionRow>(
    "SELECT * FROM checklist_questions WHERE template_id = ? AND active = 1 ORDER BY sort_order",
    [audit.template_id],
  );
  const responses = await all<ResponseRow>(
    `SELECT r.*, (SELECT count(*) FROM audit_response_documents rd WHERE rd.response_id = r.id) document_count
     FROM audit_responses r WHERE r.audit_id = ?`,
    [audit.id],
  );
  const documents = await all<DocumentRow>(
    `SELECT d.* FROM documents d JOIN audit_response_documents rd ON rd.document_id = d.id
     JOIN audit_responses r ON r.id = rd.response_id WHERE r.audit_id = ?`,
    [audit.id],
  );
  const responseDocuments = await all<{ response_id: string; document_id: string }>(
    `SELECT rd.response_id, rd.document_id FROM audit_response_documents rd JOIN audit_responses r ON r.id=rd.response_id WHERE r.audit_id=?`,
    [audit.id],
  );
  const breakdown = calculateAuditScore(questions, responses);
  return { questions, responses, documents, responseDocuments, breakdown };
}

export async function auditDetail(scope: Scope, id: string) {
  const audit = await getAudit(scope, id);
  if (!audit) return null;
  const { questions, responses, documents, responseDocuments, breakdown } = await auditQuestions(audit);
  const findings = await all<FindingRow>(
    "SELECT f.*, u.name responsible_name FROM findings f LEFT JOIN users u ON u.id=f.responsible_user_id WHERE f.audit_id=? AND f.deleted_at IS NULL ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
    [id],
  );
  const evidence = await all<DocumentRow>(
    `SELECT d.*, u.name uploaded_by_name FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by
     WHERE d.audit_id=? AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
    [id],
  );
  const report = await get<ReportRow>(
    "SELECT * FROM audit_reports WHERE audit_id = ? ORDER BY version DESC LIMIT 1",
    [id],
  );
  const logs = await all<{ id: string; action: string; summary: string; created_at: string; actor_name: string | null }>(
    `SELECT l.id, l.action, l.summary, l.created_at, u.name actor_name FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_id
     WHERE l.entity_type='audit' AND l.entity_id=? ORDER BY l.created_at DESC LIMIT 12`,
    [id],
  );
  return { audit, questions, responses, documents, responseDocuments, breakdown, findings, evidence, report, logs };
}

export async function recentAuditsForOutlet(scope: Scope, outletId: string) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<AuditRow>(
    `SELECT a.*, u.name auditor_name FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN users u ON u.id=a.auditor_id
     WHERE ${scopeSql.sql} AND a.outlet_id=? ORDER BY a.planned_date DESC LIMIT 10`,
    [...scopeSql.params, outletId],
  );
}

export async function scheduledCalendar(scope: Scope, month: string) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<
    AuditRow & { outlet_name: string; auditor_name: string; region_name: string }
  >(
    `SELECT a.*, o.name outlet_name, u.name auditor_name, r.name region_name
     FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN users u ON u.id=a.auditor_id JOIN regions r ON r.id=o.region_id
     WHERE ${scopeSql.sql} AND a.planned_date >= ? AND a.planned_date < to_char((?::date + interval '1 month'), 'YYYY-MM-DD') AND a.status != 'cancelled'
     ORDER BY a.planned_date, a.title`,
    [...scopeSql.params, `${month}-01`, `${month}-01`],
  );
}

export async function planningAudits(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<
    AuditRow & { outlet_name: string; auditor_name: string; region_name: string }
  >(
    `SELECT a.*, o.name outlet_name, u.name auditor_name, r.name region_name
     FROM audits a JOIN outlets o ON o.id=a.outlet_id JOIN users u ON u.id=a.auditor_id JOIN regions r ON r.id=o.region_id
     WHERE ${scopeSql.sql} AND a.planned_date >= to_char(CURRENT_DATE - interval '30 day', 'YYYY-MM-DD') ORDER BY a.planned_date ASC LIMIT 120`,
    scopeSql.params,
  );
}

export async function auditSchedules(scope: Scope) {
  const scopeSql = outletScopeSql(scope, "o");
  return await all<{
    id: string;
    frequency: string;
    next_date: string;
    occurrences: number;
    active: number;
    outlet_name: string;
    template_name: string;
    auditor_name: string;
  }>(
    `SELECT s.id, s.frequency, s.next_date, s.occurrences, s.active, o.name outlet_name, t.name template_name, u.name auditor_name
     FROM audit_schedules s JOIN outlets o ON o.id=s.outlet_id JOIN audit_templates t ON t.id=s.template_id JOIN users u ON u.id=s.auditor_id
     WHERE ${scopeSql.sql} ORDER BY s.next_date`,
    scopeSql.params,
  );
}
