import { newId, nextYearRef, nowIso, run } from "@/db";
import { logActivity } from "./activity";
import { escalateCriticalFinding, notifyOutletManagers, notifyUsers } from "./notifications";

export function raiseFinding(input: {
  actorId: string;
  outletId: string;
  auditId?: string | null;
  category: string;
  title: string;
  description: string;
  expectedControl?: string | null;
  actualObservation?: string | null;
  rootCause?: string | null;
  recommendation?: string | null;
  severity: string;
  financialImpactKobo?: number;
  responsibleUserId?: string | null;
  targetDate?: string | null;
  sourceResponseId?: string | null;
  isRepeated?: boolean;
  department?: string;
  createAction?: boolean;
}) {
  const id = newId();
  const ref = nextYearRef("finding", "FND");
  const createdAt = nowIso();
  run(
    `INSERT INTO findings (id, ref, audit_id, outlet_id, category, title, description, expected_control, actual_observation, root_cause, recommendation, financial_impact_kobo, severity, risk_score, status, responsible_user_id, target_date, is_repeated, source_response_id, created_by, created_at, updated_at, version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      ref,
      input.auditId ?? null,
      input.outletId,
      input.category,
      input.title,
      input.description,
      input.expectedControl ?? null,
      input.actualObservation ?? null,
      input.rootCause ?? null,
      input.recommendation ?? null,
      input.financialImpactKobo ?? 0,
      input.severity,
      input.severity === "critical" ? 25 : input.severity === "high" ? 16 : input.severity === "medium" ? 9 : 4,
      "open",
      input.responsibleUserId ?? null,
      input.targetDate ?? null,
      input.isRepeated ? 1 : 0,
      input.sourceResponseId ?? null,
      input.actorId,
      createdAt,
      createdAt,
      1,
    ],
  );
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), id, "created", null, "open", "Finding created and assigned for management response.", input.actorId, createdAt],
  );

  notifyOutletManagers(input.outletId, {
    type: "finding",
    severity: input.severity === "critical" ? "critical" : "warning",
    title: `New ${input.severity} finding — ${ref}`,
    body: `${input.title}. A management response and corrective action are required.`,
    link: `/findings/${id}`,
  });
  if (input.responsibleUserId) {
    notifyUsers([input.responsibleUserId], {
      type: "finding",
      severity: input.severity === "critical" ? "critical" : "warning",
      title: `Finding assigned — ${ref}`,
      body: `${input.title} requires your response.`,
      link: `/findings/${id}`,
    });
  }
  if (input.severity === "critical") {
    escalateCriticalFinding({ findingId: id, ref, title: input.title, outletId: input.outletId, severity: input.severity });
  }
  if (input.createAction !== false && input.responsibleUserId) {
    createCorrectiveAction({
      actorId: input.actorId,
      findingId: id,
      description: `Remediate: ${input.title}`,
      officerId: input.responsibleUserId,
      dueDate: input.targetDate ?? null,
      department: input.department ?? null,
      priority: input.severity,
    });
  }
  logActivity({
    actorId: input.actorId,
    action: "finding.created",
    entityType: "finding",
    entityId: id,
    summary: `Raised ${input.severity} finding ${ref}: ${input.title}`,
    metadata: { outletId: input.outletId, auditId: input.auditId, ref },
  });
  return { id, ref };
}

export function createCorrectiveAction(input: {
  actorId: string;
  findingId: string;
  description: string;
  officerId: string;
  dueDate?: string | null;
  department?: string | null;
  priority?: string;
  dueDays?: number;
}) {
  const id = newId();
  const ref = nextYearRef("action", "CAPA");
  const due = input.dueDate ?? new Date(Date.now() + (input.dueDays ?? 30) * 86_400_000).toISOString().slice(0, 10);
  run(
    "INSERT INTO corrective_actions (id, ref, finding_id, description, department, officer_id, due_date, priority, progress, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, ref, input.findingId, input.description, input.department ?? null, input.officerId, due, input.priority ?? "medium", 0, "not_started", input.actorId, nowIso(), nowIso()],
  );
  notifyUsers([input.officerId], {
    type: "action",
    severity: "info",
    title: `Corrective action assigned — ${ref}`,
    body: `${input.description}. Due ${due}.`,
    link: `/actions/${id}`,
  });
  logActivity({
    actorId: input.actorId,
    action: "action.created",
    entityType: "corrective_action",
    entityId: id,
    summary: `Created corrective action ${ref}`,
  });
  return { id, ref };
}

export function setFindingStatus(input: {
  findingId: string;
  actorId: string;
  status: string;
  note: string;
  action: string;
}) {
  const before = run("SELECT status FROM findings WHERE id = ?", [input.findingId]);
  void before;
  run("UPDATE findings SET status = ?, updated_at = ? WHERE id = ?", [input.status, nowIso(), input.findingId]);
  run(
    "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [newId(), input.findingId, input.action, null, input.status, input.note, input.actorId, nowIso()],
  );
}
