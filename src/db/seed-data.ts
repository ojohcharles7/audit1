import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { hashPassword } from "../lib/auth/password";
import { calculateAuditScore, resultPercent } from "../lib/scoring";
import { computeRisk } from "../lib/risk";
import { DEFAULT_SETTINGS } from "../lib/settings";
import {
  ASSISTANT_MANAGERS,
  AUDITORS,
  OUTLET_MANAGERS,
  OUTLETS,
  REGIONS,
  TEMPLATE_CATALOGS,
} from "./seed-catalogs";

const YEAR = new Date().getFullYear();
const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261126);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function dateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stamp(d: Date, hour = 9) {
  const x = new Date(d);
  x.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
  return x.toISOString();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

function pad(value: number, size = 2) {
  return String(value).padStart(size, "0");
}

const counters = new Map<string, number>();
function makeRef(key: string, prefix: string, width = 4) {
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${prefix}-${YEAR}-${pad(next, width)}`;
}

const DB_TABLES = [
  "audit_response_documents",
  "audit_responses",
  "control_tests",
  "corrective_actions",
  "finding_history",
  "escalations",
  "case_access",
  "fraud_updates",
  "document_access_log",
  "documents",
  "notifications",
  "email_outbox",
  "audit_reports",
  "audit_schedules",
  "audits",
  "findings",
  "risks",
  "controls",
  "fraud_cases",
  "checklist_questions",
  "audit_templates",
  "sessions",
  "login_history",
  "activity_logs",
  "users",
  "outlets",
  "states",
  "regions",
  "settings",
  "counters",
];

function reset(db: Database) {
  db.pragma("foreign_keys = OFF");
  const triggers = [
    "trg_activity_no_update",
    "trg_activity_no_delete",
    "trg_fraud_updates_no_update",
    "trg_fraud_updates_no_delete",
    "trg_responses_no_insert_locked",
    "trg_responses_no_update_locked",
    "trg_responses_no_delete_locked",
    "trg_reports_no_delete",
  ];
  for (const t of triggers) db.exec(`DROP TRIGGER IF EXISTS ${t}`);
  for (const table of DB_TABLES) db.exec(`DELETE FROM ${table}`);
  db.pragma("foreign_keys = ON");
}

function recreateTriggers(db: Database) {
  const migration = path.join(process.cwd(), "src", "db", "migrations", "001_init.sql");
  const sql = fs.readFileSync(migration, "utf8");
  db.exec(sql);
}

type UserSeed = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  phone: string;
  initials: string;
  outlet_id: string | null;
  region_id: string | null;
  lastLoginDays: number;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function hashWithPrev(prevHash: string | null, payload: Record<string, unknown>) {
  return crypto
    .createHash("sha256")
    .update((prevHash ?? "genesis") + JSON.stringify(payload))
    .digest("hex");
}

const BASE_EVIDENCE: { name: string; mime: string; body: Buffer; ext: string }[] = [
  {
    name: "cash-count-sheet.txt",
    mime: "text/plain",
    ext: "txt",
    body: Buffer.from(
      "CRUNCHIES FRIED CHICKEN\nDAILY CASH COUNT & RECONCILIATION SHEET\n\nOpening float: NGN 50,000\nCash sales per POS: NGN 412,500\nCash counted: NGN 409,800\nVariance: NGN (2,700)\nCounted by: Outlet Manager\nWitnessed by: Cashier\nStatus: Variance escalated to regional finance.\n",
    ),
  },
  {
    name: "pos-z-report.txt",
    mime: "text/plain",
    ext: "txt",
    body: Buffer.from(
      "POS Z-REPORT — CRUNCHIES OUTLET\nBusiness date: demo\nTerminal: POS-01\nGross sales: NGN 812,400\nCard: NGN 399,900\nTransfer: NGN 0\nCash: NGN 412,500\nVoids: NGN 18,000\nRefunds: NGN 4,500\nDiscounts: NGN 12,600\nZ-report sequence valid.\n",
    ),
  },
  {
    name: "stock-count-working-paper.txt",
    mime: "text/plain",
    ext: "txt",
    body: Buffer.from(
      "STOCK COUNT WORKING PAPER\nCount team: Internal Audit + Outlet Team\nSample lines: Chicken, Chips, Drinks, Packaging\nSystem quantity vs physical quantity reviewed.\nVariances above threshold listed and investigated.\n",
    ),
  },
  {
    name: "cctv-retention-log.txt",
    mime: "text/plain",
    ext: "txt",
    body: Buffer.from(
      "CCTV RETENTION LOG\nNVR status: online\nCameras online: 8 of 8\nRetention: 30 days\nLast backup: 02:00\nExport reference: CCTV-EXPORT-4412\n",
    ),
  },
  {
    name: "supplier-invoice.txt",
    mime: "text/plain",
    ext: "txt",
    body: Buffer.from(
      "SUPPLIER INVOICE (DEMO)\nInvoice number: INV-9041\nPurchase order: PO-2210\nGoods received note: GRN-7781\nThree-way match: complete\nApproved by: Procurement Manager\n",
    ),
  },
  {
    name: "outlet-photo.png",
    mime: "image/png",
    ext: "png",
    body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAP0lEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwZgAAAQABm3l0AAAAAElFTkSuQmCC",
      "base64",
    ),
  },
];

let baseFiles: { name: string; mime: string; sha: string }[] = [];

function ensureBaseFiles() {
  const dir = path.join(process.cwd(), "storage", "evidence");
  fs.mkdirSync(dir, { recursive: true });
  baseFiles = BASE_EVIDENCE.map((file) => {
    const target = path.join(dir, file.name);
    fs.writeFileSync(target, file.body);
    return {
      name: file.name,
      mime: file.mime,
      sha: crypto.createHash("sha256").update(file.body).digest("hex"),
    };
  });
}

export function seedDatabase(db: Database) {
  reset(db);
  recreateTriggers(db);
  ensureBaseFiles();
  counters.clear();

  const insert = (sql: string, params: unknown[]) => db.prepare(sql).run(...params);

  for (const region of REGIONS) {
    insert("INSERT INTO regions (id, name, code) VALUES (?,?,?)", [region.id, region.name, region.code]);
    for (const state of region.states) {
      const stateId = `st-${state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      insert("INSERT INTO states (id, name, region_id) VALUES (?,?,?)", [stateId, state, region.id]);
    }
  }

  const stateIdByName = new Map<string, string>();
  for (const region of REGIONS) {
    for (const state of region.states) {
      stateIdByName.set(state, `st-${state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    }
  }

  const outletManagerIds: string[] = OUTLETS.map((_, i) => `u-om-${pad(i + 1)}`);
  const outletIds: string[] = OUTLETS.map((_, i) => `o-${pad(i + 1)}`);

  for (let i = 0; i < OUTLETS.length; i++) {
    const o = OUTLETS[i]!;
    insert(
      "INSERT INTO outlets (id, code, name, address, state_id, region_id, manager_id, assistant_manager, employee_count, phone, opened_at, risk_rating, compliance_status, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        outletIds[i],
        o.code,
        `Crunchies ${o.name}`,
        o.address,
        stateIdByName.get(o.state)!,
        o.region,
        outletManagerIds[i],
        ASSISTANT_MANAGERS[i],
        o.employees,
        `+234 80${randInt(10000000, 99999999)}`,
        dateOnly(addDays(TODAY, -randInt(700, 2500))),
        o.risk,
        "pending",
        "active",
        stamp(addDays(TODAY, -randInt(700, 2500))),
      ],
    );
  }

  const users: UserSeed[] = [];
  users.push({
    id: "u-head",
    name: "Ngozi Adeyemi",
    email: "head.audit@crunchiesfood.com",
    role: "head_audit",
    title: "Head of Internal Audit",
    phone: "+234 803 100 4401",
    initials: "NA",
    outlet_id: null,
    region_id: null,
    lastLoginDays: 0,
  });
  users.push({
    id: "u-manager",
    name: "Ibrahim Bello",
    email: "audit.manager@crunchiesfood.com",
    role: "audit_manager",
    title: "Internal Audit Manager",
    phone: "+234 805 220 1188",
    initials: "IB",
    outlet_id: null,
    region_id: null,
    lastLoginDays: 0,
  });
  users.push({
    id: "u-finance",
    name: "Grace Eze",
    email: "finance@crunchiesfood.com",
    role: "finance",
    title: "Finance Business Partner",
    phone: "+234 809 331 7710",
    initials: "GE",
    outlet_id: null,
    region_id: null,
    lastLoginDays: 1,
  });
  users.push({
    id: "u-exec",
    name: "Dr. Ada Nwosu",
    email: "executive@crunchiesfood.com",
    role: "executive",
    title: "Chief Operating Officer",
    phone: "+234 802 555 9000",
    initials: "AN",
    outlet_id: null,
    region_id: null,
    lastLoginDays: 1,
  });

  REGIONS.forEach((region, i) => {
    const manager = region.manager;
    users.push({
      id: `u-rm-${region.id}`,
      name: manager.name,
      email: manager.email,
      role: "regional_manager",
      title: manager.title,
      phone: `+234 80${randInt(20000000, 89999999)}`,
      initials: initials(manager.name),
      outlet_id: null,
      region_id: region.id,
      lastLoginDays: i + 1,
    });
  });

  AUDITORS.forEach((auditor, i) => {
    users.push({
      id: `u-aud-${pad(i + 1)}`,
      name: auditor.name,
      email: auditor.email,
      role: "auditor",
      title: auditor.title,
      phone: `+234 70${randInt(20000000, 89999999)}`,
      initials: initials(auditor.name),
      outlet_id: null,
      region_id: null,
      lastLoginDays: i,
    });
  });

  OUTLETS.forEach((outlet, i) => {
    const managerName = OUTLET_MANAGERS[i]!;
    users.push({
      id: outletManagerIds[i]!,
      name: managerName,
      email: i === 0 ? "outlet@crunchiesfood.com" : `${slug(managerName)}@crunchiesfood.com`,
      role: "outlet_manager",
      title: `Outlet Manager, ${outlet.name}`,
      phone: `+234 81${randInt(20000000, 89999999)}`,
      initials: initials(managerName),
      outlet_id: outletIds[i]!,
      region_id: outlet.region,
      lastLoginDays: randInt(0, 5),
    });
  });

  const password = "Audit@2026";
  for (const user of users) {
    const { salt, hash } = hashPassword(password);
    insert(
      "INSERT INTO users (id, name, email, password_salt, password_hash, role, title, phone, initials, outlet_id, region_id, status, mfa_enabled, last_login_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        user.id,
        user.name,
        user.email,
        salt,
        hash,
        user.role,
        user.title,
        user.phone,
        user.initials,
        user.outlet_id,
        user.region_id,
        "active",
        0,
        stamp(addDays(TODAY, -user.lastLoginDays), randInt(8, 18)),
        stamp(addDays(TODAY, -randInt(300, 900))),
      ],
    );
  }

  const outletManagerByOutlet = new Map<string, string>();
  OUTLETS.forEach((_, i) => outletManagerByOutlet.set(outletIds[i]!, outletManagerIds[i]!));

  type QuestionSeed = {
    id: string;
    template_id: string;
    section: string;
    code: string;
    text: string;
    category: string;
    control_objective: string;
    procedure: string;
    expected_control: string;
    response_type: string;
    risk_level: string;
    evidence_required: string;
    weight: number;
    mandatory: number;
    sort_order: number;
  };

  const templates: { id: string; category: string; name: string }[] = [];
  const questionsByCategory = new Map<string, QuestionSeed[]>();

  for (const [category, catalog] of Object.entries(TEMPLATE_CATALOGS)) {
    const templateId = `tpl-${category}`;
    insert(
      "INSERT INTO audit_templates (id, code, name, category, version, description, active, created_by, approved_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        templateId,
        catalog.code,
        catalog.name,
        category,
        randInt(1, 3),
        catalog.description,
        1,
        "u-head",
        "u-head",
        stamp(addDays(TODAY, -randInt(200, 500))),
      ],
    );
    templates.push({ id: templateId, category, name: catalog.name });
    let order = 0;
    const questionSeeds: QuestionSeed[] = [];
    for (const section of catalog.sections) {
      for (const item of section.items) {
        order++;
        const text = item[0];
        const risk = item[1] || "medium";
        const evidence = item[2] || "none";
        const type = item[3] || "compliance";
        const weight = risk === "high" || risk === "critical" ? 3 : risk === "medium" ? 2 : 1;
        const question: QuestionSeed = {
          id: `q-${category}-${pad(order)}`,
          template_id: templateId,
          section: section.section,
          code: `${catalog.code.replace("TPL-", "")}-${pad(order)}`,
          text,
          category,
          control_objective: `Confirm that ${text.charAt(0).toLowerCase()}${text.slice(1).replace(/\.$/, "")}`,
          procedure: `Inspect records, sample transactions and observe the control for: ${text}`,
          expected_control: text,
          response_type: type,
          risk_level: risk,
          evidence_required: evidence,
          weight,
          mandatory: 1,
          sort_order: order,
        };
        questionSeeds.push(question);
        insert(
          "INSERT INTO checklist_questions (id, template_id, section, code, text, category, control_objective, procedure, expected_control, response_type, risk_level, evidence_required, weight, mandatory, sort_order, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            question.id,
            question.template_id,
            question.section,
            question.code,
            question.text,
            question.category,
            question.control_objective,
            question.procedure,
            question.expected_control,
            question.response_type,
            question.risk_level,
            question.evidence_required,
            question.weight,
            question.mandatory,
            question.sort_order,
            1,
          ],
        );
      }
    }
    questionsByCategory.set(category, questionSeeds);
  }

  const outlets = OUTLETS.map((outlet, i) => ({
    ...outlet,
    id: outletIds[i]!,
    managerId: outletManagerIds[i]!,
    managerName: OUTLET_MANAGERS[i]!,
  }));

  let auditDocSeq = 0;
  function insertDocument(input: {
    originalName: string;
    base: number;
    category: string;
    outletId?: string | null;
    auditId?: string | null;
    findingId?: string | null;
    fraudCaseId?: string | null;
    actionId?: string | null;
    confidentiality?: string;
    createdAt: string;
    uploadedBy?: string;
  }) {
    const ref = makeRef("document", "DOC");
    auditDocSeq++;
    const base = baseFiles[input.base % baseFiles.length]!;
    insert(
      "INSERT INTO documents (id, ref, filename, original_name, mime_type, size_bytes, sha256, storage_path, uploaded_by, outlet_id, audit_id, finding_id, fraud_case_id, action_id, category, confidentiality, description, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        `doc-${pad(auditDocSeq, 5)}`,
        ref,
        base.name,
        input.originalName,
        base.mime,
        fs.statSync(path.join(process.cwd(), "storage", "evidence", base.name)).size,
        base.sha,
        base.name,
        input.uploadedBy ?? "u-aud-01",
        input.outletId ?? null,
        input.auditId ?? null,
        input.findingId ?? null,
        input.fraudCaseId ?? null,
        input.actionId ?? null,
        input.category,
        input.confidentiality ?? "internal",
        "Seeded demonstration evidence",
        input.createdAt,
      ],
    );
    return `doc-${pad(auditDocSeq, 5)}`;
  }

  type AuditSeed = {
    id: string;
    ref: string;
    outlet_id: string;
    outlet_name: string;
    template_id: string;
    category: string;
    status: string;
    score: number;
    compliance_rate: number;
    auditor_id: string;
    completed_at: string | null;
    planned_date: string;
    findings: { ref: string; title: string; severity: string; status: string; financial: number }[];
  };

  const auditStatusPlan = [
    ...Array(40).fill("approved"),
    ...Array(10).fill("closed"),
    ...Array(4).fill("submitted"),
    ...Array(3).fill("under_review"),
    ...Array(4).fill("in_progress"),
    ...Array(7).fill("scheduled"),
    ...Array(4).fill("overdue"),
    ...Array(2).fill("cancelled"),
  ];

  const categories = Object.keys(TEMPLATE_CATALOGS);
  const audits: AuditSeed[] = [];
  const findingsForReports: {
    ref: string;
    outlet: string;
    category: string;
    severity: string;
    status: string;
    financial: number;
    title: string;
  }[] = [];
  const demoAuditorId = "u-aud-01";
  let completedCounter = 0;
  const completedAuditIds: string[] = [];

  const rootCauses = [
    "Supervisory review was not performed consistently.",
    "The control procedure is not documented at outlet level.",
    "Staff were not trained on the updated procedure.",
    "System access was shared between team members.",
    "Approval was granted retroactively without supporting evidence.",
    "Volume pressure led to shortcuts in the closing process.",
  ];
  const recommendations = [
    "Introduce a documented daily review checklist signed by the outlet manager.",
    "Restrict system access by role and enforce independent approval.",
    "Perform weekly spot checks and retain evidence in the audit repository.",
    "Retrain the outlet team and re-test the control within 30 days.",
    "Escalate variances above threshold to regional finance within 24 hours.",
  ];

  let actionSeq = 0;
  let findingCount = 0;
  let escalationCount = 0;

  function createFinding(input: {
    auditId: string | null;
    auditRef: string | null;
    outletId: string;
    outletName: string;
    category: string;
    title: string;
    description: string;
    expected: string;
    actual: string;
    severity: string;
    financial: number;
    createdAt: string;
    status?: string;
    createdBy: string;
    sourceResponseId?: string | null;
    targetDays?: number;
    repeated?: boolean;
  }) {
    const ref = makeRef("finding", "FND");
    findingCount++;
    const status =
      input.status ??
      (chance(0.18)
        ? "resolved"
        : chance(0.14)
          ? "awaiting_verification"
          : chance(0.2)
            ? "management_response_pending"
            : chance(0.16)
              ? "open"
              : chance(0.14)
                ? "overdue"
                : chance(0.08)
                  ? "rejected"
                  : "action_in_progress");
    const targetDate = dateOnly(addDays(new Date(input.createdAt), input.targetDays ?? 30));
    const responsible = outletManagerByOutlet.get(input.outletId) ?? "u-om-01";
    const verified = ["awaiting_verification", "resolved"].includes(status);
    const closed = status === "resolved";
    const severityScore =
      input.severity === "critical" ? 25 : input.severity === "high" ? 16 : input.severity === "medium" ? 9 : 4;
    const findingId = `find-${pad(findingCount, 4)}`;
    insert(
      "INSERT INTO findings (id, ref, audit_id, outlet_id, category, title, description, expected_control, actual_observation, root_cause, recommendation, financial_impact_kobo, severity, risk_score, status, management_response, responsible_user_id, target_date, is_repeated, source_response_id, verified_by, verified_at, closed_by, closed_at, created_by, created_at, updated_at, version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        findingId,
        ref,
        input.auditId,
        input.outletId,
        input.category,
        input.title,
        input.description,
        input.expected,
        input.actual,
        pick(rootCauses),
        pick(recommendations),
        input.financial,
        input.severity,
        severityScore,
        status,
        ["action_in_progress", "awaiting_verification", "resolved", "overdue"].includes(status)
          ? "Management accepts the finding and has commenced remediation."
          : null,
        responsible,
        targetDate,
        input.repeated ? 1 : 0,
        input.sourceResponseId ?? null,
        verified ? pick(["u-aud-01", "u-aud-02", "u-aud-03"]) : null,
        verified ? stamp(new Date(input.createdAt), 15) : null,
        closed ? "u-head" : null,
        closed ? stamp(addDays(new Date(input.createdAt), 25), 16) : null,
        input.createdBy,
        input.createdAt,
        input.createdAt,
        1,
      ],
    );

    insert(
      "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [
        `fh-${pad(findingCount, 4)}-1`,
        findingId,
        "created",
        null,
        "open",
        "Finding raised from audit testing.",
        input.createdBy,
        input.createdAt,
      ],
    );
    if (status !== "open") {
      insert(
        "INSERT INTO finding_history (id, finding_id, action, from_status, to_status, note, actor_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [
          `fh-${pad(findingCount, 4)}-2`,
          findingId,
          "status_changed",
          "open",
          status,
          "Finding progressed through the remediation workflow.",
          "u-manager",
          stamp(addDays(new Date(input.createdAt), 3), 11),
        ],
      );
    }

    if (status === "critical" || (input.severity === "critical" && status !== "rejected")) {
      escalationCount++;
      insert(
        "INSERT INTO escalations (id, finding_id, level, reason, escalated_to, created_at) VALUES (?,?,?,?,?,?)",
        [
          `esc-${pad(escalationCount, 3)}`,
          findingId,
          "executive",
          `Critical finding ${ref} at ${input.outletName}`,
          "Head of Internal Audit; Executive Management; Regional Manager",
          input.createdAt,
        ],
      );
    }

    const actionWorthy = !["rejected", "resolved"].includes(status) || chance(0.6);
    if (actionWorthy) {
      actionSeq++;
      const actionRef = makeRef("action", "CAPA");
      const priority =
        input.severity === "critical" ? "critical" : input.severity === "high" ? "high" : "medium";
      let actionStatus = "in_progress";
      let progress = randInt(20, 75);
      let dueDate = dateOnly(addDays(new Date(input.createdAt), randInt(14, 45)));
      if (status === "resolved") {
        actionStatus = "closed";
        progress = 100;
        dueDate = dateOnly(addDays(new Date(input.createdAt), 20));
      } else if (status === "awaiting_verification") {
        actionStatus = "awaiting_verification";
        progress = 100;
      } else if (status === "overdue") {
        actionStatus = "in_progress";
        progress = randInt(20, 55);
        dueDate = dateOnly(addDays(TODAY, -randInt(2, 40)));
      } else if (status === "open" || status === "management_response_pending") {
        actionStatus = "not_started";
        progress = 0;
      }
      const officer =
        input.category === "financial" && chance(0.4) ? "u-finance" : responsible;
      insert(
        "INSERT INTO corrective_actions (id, ref, finding_id, description, department, officer_id, due_date, priority, progress, status, management_comments, verified_by, verification_note, verified_at, closed_by, closed_at, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          `act-${pad(actionSeq, 4)}`,
          actionRef,
          findingId,
          `Remediate: ${input.title.slice(0, 120)}`,
          input.category === "financial" ? "Finance" : input.category === "inventory" ? "Inventory" : "Operations",
          officer,
          dueDate,
          priority,
          progress,
          actionStatus,
          progress > 0 ? "Action owner has provided a progress update." : null,
          actionStatus === "closed" ? pick(["u-aud-01", "u-aud-02"]) : null,
          actionStatus === "closed" ? "Evidence reviewed and action verified." : null,
          actionStatus === "closed" ? stamp(addDays(new Date(input.createdAt), 18), 14) : null,
          actionStatus === "closed" ? "u-head" : null,
          actionStatus === "closed" ? stamp(addDays(new Date(input.createdAt), 20), 15) : null,
          responsible,
          stamp(addDays(new Date(input.createdAt), 1), 10),
          stamp(addDays(new Date(input.createdAt), 2), 10),
        ],
      );
    }

    findingsForReports.push({
      ref,
      outlet: input.outletName,
      category: input.category,
      severity: input.severity,
      status,
      financial: input.financial,
      title: input.title,
    });
    return { id: findingId, ref, status, severity: input.severity, financial: input.financial, title: input.title };
  }

  for (let i = 0; i < auditStatusPlan.length; i++) {
    const status = auditStatusPlan[i]!;
    const outlet = outlets[i % outlets.length]!;
    const category = categories[i % categories.length]!;
    const template = templates.find((t) => t.category === category)!;
    const questions = questionsByCategory.get(category)!;
    const auditorId = i % 5 === 0 ? demoAuditorId : `u-aud-${pad((i % 8) + 1)}`;
    const auditId = `audit-${pad(i + 1, 3)}`;
    const ref = makeRef("audit", "AUD");

    let planned: Date;
    let due: Date;
    let completedAt: string | null = null;
    let submittedAt: string | null = null;
    let startedAt: string | null = null;
    let approvedAt: string | null = null;
    let approvedBy: string | null = null;

    if (["approved", "closed", "submitted", "under_review"].includes(status)) {
      const daysAgo =
        completedCounter < 10 ? 2 + completedCounter * 2 : randInt(35, 330);
      completedCounter++;
      planned = addDays(TODAY, -daysAgo - randInt(2, 10));
      due = addDays(planned, 7);
      completedAt = stamp(addDays(TODAY, -daysAgo), randInt(12, 18));
      submittedAt = completedAt;
      startedAt = stamp(planned, 9);
      if (status === "approved" || status === "closed") {
        approvedAt = stamp(addDays(new Date(completedAt), 2), 10);
        approvedBy = "u-head";
      }
    } else if (status === "in_progress") {
      planned = addDays(TODAY, -randInt(2, 12));
      due = addDays(TODAY, randInt(2, 10));
      startedAt = stamp(planned, 9);
    } else if (status === "scheduled") {
      planned = addDays(TODAY, randInt(3, 55));
      due = addDays(planned, 7);
    } else if (status === "overdue") {
      planned = addDays(TODAY, -randInt(10, 45));
      due = addDays(TODAY, -randInt(1, 8));
    } else {
      planned = addDays(TODAY, chance(0.5) ? randInt(4, 30) : -randInt(30, 60));
      due = addDays(planned, 7);
    }

    const hasResponses = ["approved", "closed", "submitted", "under_review", "in_progress"].includes(status);
    const auditType =
      i % 11 === 0
        ? "surprise"
        : category === "financial"
          ? "financial"
          : category === "inventory"
            ? "inventory"
            : i % 9 === 0
              ? "follow_up"
              : "routine";
    const categoryName = template.name.replace(" Audit", "");
    const title = `${categoryName} — ${outlet.name}`;
    const qualityBase =
      0.9 -
      (outlet.risk === "critical" ? 0.2 : outlet.risk === "high" ? 0.1 : outlet.risk === "medium" ? 0.04 : 0);
    const quality = Math.max(0.48, Math.min(0.97, qualityBase + (rand() - 0.5) * 0.12));

    insert(
      "INSERT INTO audits (id, ref, outlet_id, template_id, audit_type, category, title, auditor_id, manager_id, planned_date, due_date, started_at, completed_at, status, objectives, scope, methodology, submitted_at, approved_by, approved_at, created_by, created_at, notes, version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        auditId,
        ref,
        outlet.id,
        template.id,
        auditType,
        category,
        title,
        auditorId,
        "u-manager",
        dateOnly(planned),
        dateOnly(due),
        startedAt,
        completedAt,
        status,
        `Assess the design and operating effectiveness of ${categoryName.toLowerCase()} controls at ${outlet.name}.`,
        `All ${categoryName.toLowerCase()} processes, records and supervisory controls for the audit period.`,
        "Inspection, transaction testing, observation, interviews and evidence review.",
        submittedAt,
        approvedBy,
        approvedAt,
        "u-head",
        stamp(planned, 8),
        null,
        1,
      ],
    );

    let auditDocs: string[] = [];
    if (hasResponses) {
      auditDocs = [
        insertDocument({
          originalName: `${ref}-working-paper.txt`,
          base: 2,
          category: "audit_working_paper",
          outletId: outlet.id,
          auditId,
          createdAt: stamp(planned, 10),
        }),
        insertDocument({
          originalName: `${ref}-evidence-${chance(0.5) ? "photo.png" : "cash-sheet.txt"}`,
          base: chance(0.5) ? 0 : 5,
          category: chance(0.5) ? "photo_evidence" : "financial_record",
          outletId: outlet.id,
          auditId,
          createdAt: stamp(planned, 11),
        }),
        insertDocument({
          originalName: `${ref}-pos-z-report.txt`,
          base: 1,
          category: "financial_record",
          outletId: outlet.id,
          auditId,
          createdAt: stamp(planned, 12),
        }),
      ];
    }

    const inMemoryResponses: {
      question_id: string;
      result: string | null;
      numeric_value: number | null;
      text_value: string | null;
      amount_kobo: number | null;
      document_count: number;
    }[] = [];
    const responseIds: string[] = [];
    let responseSeq = 0;

    if (hasResponses) {
      for (const question of questions) {
        if (status === "in_progress" && !chance(0.68)) continue;
        responseSeq++;
        let result: string | null = null;
        let numeric: number | null = null;
        let text: string | null = null;
        let amount: number | null = null;

        if (question.response_type === "numeric") {
          numeric = randInt(0, 120);
          text = `${numeric} units variance identified; investigation opened where above threshold.`;
        } else if (question.response_type === "financial") {
          amount = randInt(20_000, 600_000) * 100;
        } else if (question.response_type === "text" || question.response_type === "date") {
          text = "Reviewed and documented during fieldwork.";
        } else {
          const penalty = question.risk_level === "critical" ? 0.09 : question.risk_level === "high" ? 0.05 : 0.02;
          const p = quality - penalty;
          const r = rand();
          result =
            r < 0.035
              ? "na"
              : r < p
                ? "compliant"
                : r < p + 0.1
                  ? "partial"
                  : r < p + 0.13
                    ? "investigation"
                    : "noncompliant";
        }

        const answeredAt =
          status === "in_progress" || !completedAt ? stamp(addDays(TODAY, -randInt(0, 5)), randInt(9, 17)) : completedAt;
        let docId: string | null = null;
        if (question.evidence_required !== "none" && chance(0.94) && auditDocs.length > 0) {
          docId = pick(auditDocs);
        }
        responseIds.push(docId ?? "");
        insert(
          "INSERT INTO audit_responses (id, audit_id, question_id, result, score_awarded, numeric_value, text_value, amount_kobo, comment, answered_by, answered_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            `resp-${pad(i + 1, 3)}-${pad(responseSeq, 3)}`,
            auditId,
            question.id,
            result,
            result ? resultPercent(result) : null,
            numeric,
            text,
            amount,
            result === "noncompliant"
              ? "Control exception observed and discussed with outlet management."
              : result === "partial"
                ? "Control partially operating; coaching provided."
                : "No exception noted.",
            auditorId,
            answeredAt,
            answeredAt,
          ],
        );
        if (docId) {
          insert("INSERT INTO audit_response_documents (response_id, document_id) VALUES (?,?)", [
            `resp-${pad(i + 1, 3)}-${pad(responseSeq, 3)}`,
            docId,
          ]);
        }
        inMemoryResponses.push({
          question_id: question.id,
          result,
          numeric_value: numeric,
          text_value: text,
          amount_kobo: amount,
          document_count: docId ? 1 : 0,
        });
      }
    }

    const score = calculateAuditScore(questions, inMemoryResponses);
    const rating =
      score.score >= 85 ? "low" : score.score >= 70 ? "medium" : score.score >= 55 ? "high" : "critical";

    if (hasResponses) {
      insert("UPDATE audits SET score = ?, compliance_rate = ?, risk_rating = ? WHERE id = ?", [
        score.score,
        score.complianceRate,
        rating,
        auditId,
      ]);
      if (["approved", "closed", "submitted", "under_review"].includes(status)) {
        insert("UPDATE audits SET locked_at = ? WHERE id = ?", [submittedAt ?? completedAt, auditId]);
      }
    }

    const auditSeed: AuditSeed = {
      id: auditId,
      ref,
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      template_id: template.id,
      category,
      status,
      score: score.score,
      compliance_rate: score.complianceRate,
      auditor_id: auditorId,
      completed_at: completedAt,
      planned_date: dateOnly(planned),
      findings: [],
    };
    audits.push(auditSeed);

    if (hasResponses && ["approved", "closed", "submitted", "under_review"].includes(status)) {
      completedAuditIds.push(auditId);
      const exceptionResponses = inMemoryResponses.filter(
        (r) => (r.result === "noncompliant" || r.result === "investigation") && r.result,
      );
      const issueQuestions = questions.filter((q) =>
        exceptionResponses.some((r) => r.question_id === q.id && (q.risk_level === "high" || q.risk_level === "critical")),
      );
      let created = 0;
      for (const question of issueQuestions) {
        if (created >= 2) break;
        const response = inMemoryResponses.find((r) => r.question_id === question.id);
        if (!response) continue;
        const severity = question.risk_level === "critical" ? "critical" : question.risk_level;
        const financial =
          ["financial", "inventory", "asset", "procurement"].includes(category) && chance(0.72)
            ? randInt(severity === "critical" ? 400_000 : 25_000, severity === "critical" ? 2_500_000 : 900_000) * 100
            : 0;
        const finding = createFinding({
          auditId,
          auditRef: ref,
          outletId: outlet.id,
          outletName: outlet.name,
          category,
          title: question.text.length > 78 ? `${question.text.slice(0, 75)}…` : question.text.replace(/\.$/, ""),
          description: `Audit testing at ${outlet.name} identified an exception against the expected control.`,
          expected: question.expected_control || question.text,
          actual: response.result === "investigation" ? "Requires further investigation." : "Control not operating as designed.",
          severity,
          financial,
          createdAt: completedAt ?? stamp(addDays(TODAY, -20), 15),
          createdBy: auditorId,
          sourceResponseId: `resp-${pad(i + 1, 3)}-${pad(
            inMemoryResponses.findIndex((r) => r.question_id === question.id) + 1,
            3,
          )}`,
          targetDays: randInt(14, 45),
          repeated: chance(0.16),
        });
        created++;
        auditSeed.findings.push(finding);
      }
    }
  }

  const manualFindings = [
    ["Cash count variance not supported by an investigation memo.", "financial", "high", 340_000],
    ["Bank deposit delayed by more than two business days.", "financial", "high", 780_000],
    ["Stock adjustments posted without approval evidence.", "inventory", "high", 1_250_000],
    ["Expired products stored with saleable inventory.", "inventory", "critical", 420_000],
    ["Duplicate supplier invoice paid without detection.", "procurement", "critical", 2_100_000],
    ["Purchase order raised after goods were received.", "procurement", "medium", 0],
    ["POS user accounts shared between cashiers.", "it", "high", 0],
    ["CCTV recorder not retaining the required 30 days.", "it", "high", 0],
    ["Overtime paid without prior approval.", "hr", "medium", 180_000],
    ["New employee file missing mandatory identification.", "hr", "low", 0],
    ["Asset register not reconciled to physical assets.", "asset", "high", 650_000],
    ["Fire extinguisher inspection overdue.", "compliance", "critical", 0],
    ["Business permit renewal not evidenced.", "compliance", "high", 0],
    ["Hygiene standard below brand requirement in food prep area.", "operational", "high", 0],
    ["Customer refund approved by the same cashier who processed the sale.", "financial", "medium", 95_000],
  ] as const;

  for (let i = 0; i < manualFindings.length; i++) {
    const [title, category, severity, financial] = manualFindings[i]!;
    const outlet = outlets[(i * 3) % outlets.length]!;
    const createdAt = stamp(addDays(TODAY, -randInt(5, 160)), randInt(9, 17));
    createFinding({
      auditId: null,
      auditRef: null,
      outletId: outlet.id,
      outletName: outlet.name,
      category,
      title,
      description: "Finding identified through continuous monitoring and outlet review.",
      expected: "An approved, documented control should operate consistently.",
      actual: "Evidence of the control could not be provided during review.",
      severity,
      financial: financial * 100,
      createdAt,
      createdBy: pick(["u-aud-02", "u-aud-03", "u-manager"]),
      targetDays: randInt(14, 45),
      repeated: i % 4 === 0,
    });
  }

  for (const outlet of outlets) {
    const latest = audits
      .filter((a) => a.outlet_id === outlet.id && ["approved", "closed"].includes(a.status))
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
    if (latest) {
      const openCritical = (db.prepare("SELECT count(*) c FROM findings WHERE outlet_id=? AND severity='critical' AND status NOT IN ('resolved','rejected')").get(outlet.id) as { c: number }).c;
      const openHigh = (db.prepare("SELECT count(*) c FROM findings WHERE outlet_id=? AND severity='high' AND status NOT IN ('resolved','rejected')").get(outlet.id) as { c: number }).c;
      const scoreRisk = latest.score >= 85 ? "low" : latest.score >= 70 ? "medium" : latest.score >= 55 ? "high" : "critical";
      const risk = openCritical >= 2 ? "critical" : openCritical >= 1 || openHigh >= 4 ? "high" : scoreRisk;
      insert("UPDATE outlets SET last_audit_score = ?, last_audit_at = ?, risk_rating = ?, compliance_status = ? WHERE id = ?", [
        latest.score,
        latest.completed_at,
        risk,
        latest.score >= 85 ? "compliant" : latest.score >= 60 ? "partially_compliant" : "non_compliant",
        outlet.id,
      ]);
    }
  }

  let riskSeq = 0;
  const riskSeeds = [
    ["Cash misappropriation at high-volume outlets", "Financial", "high", "satisfactory", "cash"],
    ["Sales skimming through void and refund abuse", "Fraud", "critical", "weak", "fraud"],
    ["Inventory shrinkage across protein and packaging", "Inventory", "high", "weak", "inventory"],
    ["Fictitious supplier onboarding", "Fraud", "critical", "satisfactory", "procurement"],
    ["Duplicate supplier payments", "Financial", "high", "satisfactory", "procurement"],
    ["Unauthorised discounts at counter", "Financial", "medium", "weak", "financial"],
    ["POS transaction data tampering", "IT & Cyber", "critical", "satisfactory", "it"],
    ["Ransomware or POS malware at outlet", "IT & Cyber", "critical", "satisfactory", "it"],
    ["CCTV blind spots in cash handling areas", "Operational", "high", "weak", "it"],
    ["Payroll ghost workers", "Fraud", "high", "weak", "hr"],
    ["Collusion between outlet staff and suppliers", "Fraud", "critical", "weak", "procurement"],
    ["Regulatory non-compliance and permit lapse", "Compliance", "high", "satisfactory", "compliance"],
    ["Food safety incident leading to closure", "Reputational", "critical", "satisfactory", "compliance"],
    ["Fire safety equipment failure", "Operational", "critical", "weak", "compliance"],
    ["Theft of outlet equipment and assets", "Operational", "high", "weak", "asset"],
    ["Cash-in-transit loss", "Financial", "high", "satisfactory", "cash"],
    ["Budget overrun at regional level", "Financial", "medium", "satisfactory", "finance"],
    ["Over-reliance on a single supplier", "Operational", "medium", "strong", "procurement"],
    ["Reputational damage from employee fraud", "Reputational", "high", "satisfactory", "fraud"],
    ["Customer data privacy breach", "IT & Cyber", "high", "weak", "it"],
    ["Inaccurate management reporting", "Financial", "medium", "satisfactory", "finance"],
    ["Unreconciled bank accounts", "Financial", "high", "satisfactory", "cash"],
    ["Inventory valuation error", "Inventory", "medium", "satisfactory", "inventory"],
    ["Contract non-compliance by service providers", "Compliance", "medium", "weak", "compliance"],
  ] as const;

  const riskIds: string[] = [];
  for (let i = 0; i < riskSeeds.length; i++) {
    const [title, category, likelihood, effectiveness, area] = riskSeeds[i]!;
    riskSeq++;
    const id = `risk-${pad(riskSeq, 3)}`;
    riskIds.push(id);
    const outlet = i % 3 === 0 ? outlets[i % outlets.length]! : null;
    const impact = category === "Reputational" || likelihood === "critical" ? 5 : randInt(3, 5);
    const l = likelihood === "critical" ? randInt(4, 5) : likelihood === "high" ? randInt(3, 4) : randInt(2, 3);
    const computed = computeRisk(l, impact, effectiveness, DEFAULT_SETTINGS.risk);
    insert(
      "INSERT INTO risks (id, ref, outlet_id, category, title, description, cause, likelihood, impact, inherent_score, existing_controls, control_effectiveness, residual_score, rating, owner_id, mitigation, review_date, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        makeRef("risk", "RSK"),
        outlet?.id ?? null,
        category,
        title,
        `Enterprise risk assessment covering ${area} exposures across the outlet network.`,
        "Control design gaps, inconsistent supervision and manual workarounds.",
        l,
        impact,
        computed.inherent,
        "Documented policies, supervisory review, reconciliation and audit testing.",
        effectiveness,
        computed.residual,
        computed.rating,
        i % 4 === 0 ? "u-manager" : i % 4 === 1 ? "u-head" : i % 4 === 2 ? "u-finance" : outlet?.managerId ?? "u-manager",
        "Strengthen preventive controls, perform targeted testing and track remediation to closure.",
        dateOnly(addDays(TODAY, randInt(20, 180))),
        computed.rating === "critical" ? "escalated" : "open",
        "u-manager",
        stamp(addDays(TODAY, -randInt(20, 240))),
        stamp(addDays(TODAY, -randInt(1, 20))),
      ],
    );
  }

  const controlSeeds: [string, string, string, string, string][] = [
    ["Daily cash reconciliation review", "Finance", "Daily", "effective", "Cash"],
    ["Next-business-day banking", "Finance", "Daily", "partially_effective", "Cash"],
    ["Void and refund approval", "Operations", "Per transaction", "weak", "Cash"],
    ["Petty cash imprest reconciliation", "Finance", "Weekly", "effective", "Cash"],
    ["Cashier float verification", "Operations", "Daily", "partially_effective", "Cash"],
    ["Month-end financial close review", "Finance", "Monthly", "effective", "Finance"],
    ["Independent stock count", "Inventory", "Monthly", "weak", "Inventory"],
    ["Three-way match on goods received", "Procurement", "Per transaction", "partially_effective", "Procurement"],
    ["Stock adjustment approval", "Inventory", "Per transaction", "weak", "Inventory"],
    ["Wastage approval and write-off", "Operations", "Daily", "partially_effective", "Inventory"],
    ["Purchase requisition approval", "Procurement", "Per transaction", "effective", "Procurement"],
    ["Supplier master data maintenance", "Procurement", "Monthly", "partially_effective", "Procurement"],
    ["Purchase order approval limits", "Procurement", "Per transaction", "effective", "Procurement"],
    ["Duplicate invoice detection", "Finance", "Per transaction", "weak", "Procurement"],
    ["Goods received inspection", "Inventory", "Per delivery", "partially_effective", "Procurement"],
    ["POS user access review", "Information Technology", "Monthly", "weak", "IT"],
    ["Password change enforcement", "Information Technology", "Quarterly", "partially_effective", "IT"],
    ["CCTV retention monitoring", "Information Technology", "Weekly", "ineffective", "IT"],
    ["Backup restoration testing", "Information Technology", "Quarterly", "partially_effective", "IT"],
    ["Network availability monitoring", "Information Technology", "Daily", "effective", "IT"],
    ["Time and attendance review", "Human Resources", "Weekly", "partially_effective", "HR"],
    ["Payroll change approval", "Human Resources", "Monthly", "effective", "HR"],
    ["Overtime authorisation", "Human Resources", "Weekly", "weak", "HR"],
    ["New hire vetting", "Human Resources", "Per hire", "partially_effective", "HR"],
    ["Asset register reconciliation", "Facilities & Assets", "Quarterly", "weak", "Assets"],
    ["Asset disposal approval", "Facilities & Assets", "Per transaction", "effective", "Assets"],
    ["Food safety temperature logging", "Operations", "Daily", "partially_effective", "Compliance"],
    ["Fire extinguisher inspection", "Compliance", "Monthly", "ineffective", "Compliance"],
    ["Business permit renewal tracking", "Compliance", "Annually", "partially_effective", "Compliance"],
    ["Regulatory inspection closure", "Compliance", "Per inspection", "weak", "Compliance"],
    ["Segregation of duties — cash", "Finance", "Daily", "weak", "Finance"],
    ["Segregation of duties — procurement", "Procurement", "Per transaction", "partially_effective", "Procurement"],
  ];

  const controlIds: string[] = [];
  controlSeeds.forEach((control, i) => {
    const [name, department, frequency, effectiveness, area] = control;
    const id = `ctrl-${pad(i + 1, 3)}`;
    controlIds.push(id);
    const lastTested = chance(0.8) ? stamp(addDays(TODAY, -randInt(5, 200)), 14) : null;
    insert(
      "INSERT INTO controls (id, control_ref, name, description, objective, owner_id, department, frequency, test_procedure, evidence_required, effectiveness, last_tested_at, next_test_at, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        `CTL-${pad(i + 1, 3)}`,
        name,
        `Operating control covering ${area.toLowerCase()} at outlet and regional level.`,
        `Ensure ${name.toLowerCase()} operates consistently and evidence is retained.`,
        department === "Finance" ? "u-finance" : department === "Information Technology" ? "u-manager" : "u-manager",
        department,
        frequency,
        "Inspect evidence for a sample of transactions, re-perform the control and record exceptions.",
        "Approved report, reconciliation, system log or signed checklist",
        effectiveness,
        lastTested,
        dateOnly(addDays(TODAY, randInt(5, 90))),
        "active",
        stamp(addDays(TODAY, -randInt(200, 500))),
        stamp(addDays(TODAY, -randInt(1, 60))),
      ],
    );
    if (lastTested && chance(0.75)) {
      const result =
        effectiveness === "effective"
          ? "effective"
          : effectiveness === "partially_effective"
            ? "partially_effective"
            : chance(0.7)
              ? "ineffective"
              : "partially_effective";
      insert(
        "INSERT INTO control_tests (id, control_id, audit_id, tester_id, tested_at, result, sample_size, exceptions, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          `ctest-${pad(i + 1, 3)}`,
          id,
          completedAuditIds[i % completedAuditIds.length] ?? null,
          pick(["u-aud-01", "u-aud-02", "u-aud-03", "u-manager"]),
          lastTested,
          result,
          randInt(10, 60),
          result === "effective" ? 0 : randInt(1, 6),
          result === "effective" ? "Control operated as designed for the sample." : "Exceptions identified and discussed with the control owner.",
          lastTested,
        ],
      );
    }
  });

  const fraudSeed = [
    ["Missing cash collections", "Cash theft", 3_200_000, "investigating", 2, 2],
    ["Suspicious POS void patterns", "POS manipulation", 1_850_000, "evidence_review", 3, 4],
    ["Protein inventory shrinkage", "Inventory theft", 4_500_000, "investigating", 4, 6],
    ["Fictitious supplier payment", "Supplier fraud", 7_200_000, "pending_closure", 9, 10],
    ["Payroll ghost workers", "Payroll fraud", 2_600_000, "closed", 7, 9],
    ["Refund manipulation at counter", "Refund manipulation", 950_000, "registered", 0, 3],
    ["Unauthorised staff discounts", "Unauthorised discounts", 1_400_000, "referred", 8, 11],
    ["Missing kitchen equipment", "Asset theft", 3_800_000, "closed", 6, 8],
  ] as const;
  const fraudIds: string[] = [];
  fraudSeed.forEach((fraud, i) => {
    const [title, type, exposure, status, incidentDays, openedDays] = fraud;
    const id = `fraud-${pad(i + 1, 3)}`;
    fraudIds.push(id);
    const outlet = outlets[(i * 4 + 2) % outlets.length]!;
    const officer = AUDITORS[(i % 4) + 1]!;
    const openedAt = stamp(addDays(TODAY, -openedDays), 10);
    insert(
      "INSERT INTO fraud_cases (id, ref, title, type, description, officer_id, outlet_id, suspected_exposure_kobo, incident_date, location, witnesses, status, conclusion, opened_at, closed_at, closure_approved_by, closure_approved_at, created_by, created_at, restricted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        makeRef("fraud", "FRD"),
        title,
        type,
        "Confidential investigation into suspected irregularity. Access restricted to authorised officers.",
        `u-aud-${pad((i % 6) + 2)}`,
        outlet.id,
        exposure * 100,
        dateOnly(addDays(TODAY, -incidentDays - 3)),
        `${outlet.name}, ${outlet.state}`,
        "Names withheld — see interview records",
        status,
        status === "closed" ? "Investigation confirmed the irregularity. Disciplinary and recovery actions completed." : null,
        openedAt,
        status === "closed" ? stamp(addDays(TODAY, -1), 15) : null,
        status === "closed" ? "u-head" : null,
        status === "closed" ? stamp(addDays(TODAY, -1), 16) : null,
        "u-head",
        openedAt,
        1,
      ],
    );

    const notes: { kind: string; content: string }[] = [
      { kind: "note", content: `Case registered following ${type.toLowerCase()} indicators identified during audit fieldwork.` },
      { kind: "interview", content: "Preliminary interview conducted with the outlet manager. Statement recorded and reviewed." },
      { kind: "evidence", content: "POS journal, cash count sheets and CCTV export secured in the evidence repository." },
    ];
    if (["pending_closure", "closed", "referred"].includes(status)) {
      notes.push({ kind: "escalation", content: "Investigation findings escalated to the Head of Internal Audit for closure decision." });
    }
    let prevHash: string | null = null;
    notes.forEach((note, n) => {
      const createdAt = stamp(addDays(new Date(openedAt), n + 1), 9 + n);
      const occurredAt = createdAt;
      const payload = {
        caseId: id,
        kind: note.kind,
        content: note.content,
        authorId: `u-aud-${pad((i % 6) + 2)}`,
        occurredAt,
        createdAt,
      };
      const hash = hashWithPrev(prevHash, payload);
      insert(
        "INSERT INTO fraud_updates (id, case_id, kind, content, author_id, occurred_at, prev_hash, hash, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          `fu-${pad(i + 1, 2)}-${n + 1}`,
          id,
          note.kind,
          note.content,
          payload.authorId,
          occurredAt,
          prevHash,
          hash,
          createdAt,
        ],
      );
      prevHash = hash;
    });

    if (i < 3) {
      insert("INSERT INTO case_access (case_id, user_id, granted_by, granted_at) VALUES (?,?,?,?)", [
        id,
        demoAuditorId,
        "u-head",
        openedAt,
      ]);
    }
    insert(
      "INSERT INTO case_access (case_id, user_id, granted_by, granted_at) VALUES (?,?,?,?)",
      [id, "u-manager", "u-head", openedAt],
    );

    insertDocument({
      originalName: `${title.replace(/\s+/g, "-").toLowerCase()}-evidence.txt`,
      base: 4,
      category: "investigation_evidence",
      outletId: outlet.id,
      fraudCaseId: id,
      confidentiality: "restricted",
      createdAt: openedAt,
      uploadedBy: officer.email === "auditor@crunchiesfood.com" ? demoAuditorId : `u-aud-${pad((i % 6) + 2)}`,
    });
  });

  let scheduleSeq = 0;
  for (let i = 0; i < 10; i++) {
    scheduleSeq++;
    const outlet = outlets[(i * 2) % outlets.length]!;
    const template = templates[i % templates.length]!;
    insert(
      "INSERT INTO audit_schedules (id, outlet_id, template_id, auditor_id, frequency, next_date, occurrences, active, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        `sch-${pad(scheduleSeq, 3)}`,
        outlet.id,
        template.id,
        `u-aud-${pad((i % 8) + 1)}`,
        pick(["monthly", "quarterly", "monthly", "quarterly"]),
        dateOnly(addDays(TODAY, randInt(5, 70))),
        12,
        1,
        "u-head",
        stamp(addDays(TODAY, -randInt(20, 90))),
      ],
    );
  }

  let reportSeq = 0;
  function snapshotForAudit(audit: AuditSeed) {
    const outlet = outlets.find((o) => o.id === audit.outlet_id)!;
    return {
      meta: {
        org: "Crunchies Fried Chicken",
        department: "Internal Audit & Internal Control",
        title: `Internal Audit Report — ${outlet.name}`,
        subtitle: audit.ref,
        period: `${audit.planned_date} to ${audit.completed_at?.slice(0, 10) ?? dateOnly(TODAY)}`,
        confidentiality: "CONFIDENTIAL — Internal Use Only",
        preparedBy: "Internal Audit Department",
        generatedAt: stamp(TODAY, 10),
        reference: audit.ref,
      },
      summary: [
        { label: "Outlet", value: outlet.name },
        { label: "Overall score", value: `${audit.score}%` },
        { label: "Compliance rate", value: `${audit.compliance_rate}%` },
        { label: "Findings", value: String(audit.findings.length) },
      ],
      sections: [
        {
          heading: "1. Organisation and outlet details",
          body: `${outlet.name} (${outlet.code}) · ${outlet.address} · ${outlet.region} region.`,
        },
        {
          heading: "2. Audit scope and objectives",
          body: `The audit assessed the design and operating effectiveness of ${audit.category} controls, including records, approvals, reconciliations and supervisory review.`,
        },
        {
          heading: "3. Overall audit score",
          columns: ["Metric", "Result"],
          rows: [
            ["Overall weighted score", `${audit.score}%`],
            ["Compliance rate", `${audit.compliance_rate}%`],
            ["Risk rating", audit.score >= 85 ? "Low" : audit.score >= 70 ? "Medium" : audit.score >= 55 ? "High" : "Critical"],
          ],
        },
        {
          heading: "4. Detailed observations",
          columns: ["Reference", "Severity", "Observation", "Financial impact"],
          rows: audit.findings.map((f) => [
            f.ref,
            f.severity,
            f.title,
            f.financial ? `NGN ${(f.financial / 100).toLocaleString()}` : "—",
          ]),
        },
        {
          heading: "5. Recommendations and management action",
          body: "Management is required to implement the corrective actions in the CAPA register and provide evidence for independent verification.",
        },
      ],
      approval: [
        { role: "Prepared by", name: "Internal Audit", date: audit.completed_at?.slice(0, 10) ?? dateOnly(TODAY) },
        { role: "Approved by", name: "Head of Internal Audit", date: dateOnly(TODAY) },
      ],
    };
  }

  for (const audit of audits) {
    if (!["approved", "closed"].includes(audit.status)) continue;
    if (!chance(0.68)) continue;
    reportSeq++;
    insert(
      "INSERT INTO audit_reports (id, report_ref, audit_id, kind, title, period_start, period_end, version, status, confidentiality, snapshot_json, generated_by, generated_at, approved_by, approved_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        `report-${pad(reportSeq, 3)}`,
        makeRef("report", "RPT"),
        audit.id,
        "audit",
        `Internal Audit Report — ${audit.outlet_name}`,
        audit.planned_date,
        audit.completed_at?.slice(0, 10) ?? dateOnly(TODAY),
        1,
        chance(0.7) ? "approved" : "submitted",
        "confidential",
        JSON.stringify(snapshotForAudit(audit)),
        "u-head",
        stamp(addDays(new Date(audit.completed_at ?? TODAY), 2), 11),
        "u-head",
        stamp(addDays(new Date(audit.completed_at ?? TODAY), 3), 11),
        stamp(addDays(new Date(audit.completed_at ?? TODAY), 2), 11),
      ],
    );
  }

  const managementReports: { kind: string; title: string }[] = [
    { kind: "monthly", title: "Monthly Internal Audit Report" },
    { kind: "quarterly", title: "Quarterly Internal Audit Report" },
    { kind: "risk_assessment", title: "Enterprise Risk Assessment Report" },
  ];
  for (const report of managementReports) {
    reportSeq++;
    insert(
      "INSERT INTO audit_reports (id, report_ref, audit_id, kind, title, period_start, period_end, version, status, confidentiality, snapshot_json, generated_by, generated_at, approved_by, approved_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        `report-${pad(reportSeq, 3)}`,
        makeRef("report", "RPT"),
        null,
        report.kind,
        `${report.title} — ${YEAR}`,
        dateOnly(addDays(TODAY, -90)),
        dateOnly(TODAY),
        1,
        "approved",
        "confidential",
        JSON.stringify({
          meta: {
            org: "Crunchies Fried Chicken",
            department: "Internal Audit & Internal Control",
            title: `${report.title} — ${YEAR}`,
            subtitle: "Organisation-wide assurance summary",
            period: `${dateOnly(addDays(TODAY, -90))} to ${dateOnly(TODAY)}`,
            confidentiality: "CONFIDENTIAL — Internal Use Only",
            preparedBy: "Head of Internal Audit",
            generatedAt: stamp(TODAY, 9),
            reference: "Management report",
          },
          summary: [
            { label: "Audits completed", value: String(audits.filter((a) => a.status === "approved" || a.status === "closed").length) },
            { label: "Average score", value: "78.4%" },
            { label: "Open critical findings", value: String(findingsForReports.filter((f) => f.severity === "critical").length) },
            { label: "Open fraud cases", value: String(fraudSeed.filter((f) => f[3] !== "closed").length) },
          ],
          sections: [
            { heading: "Executive summary", body: "Assurance coverage remained strong across the outlet network. Critical exceptions require executive attention." },
            { heading: "Audit performance", body: "Outlet audits and follow-up reviews were completed in line with the annual plan." },
            { heading: "Findings and remediation", body: "Corrective actions are tracked in the CAPA register with independent verification before closure." },
          ],
          approval: [{ role: "Approved by", name: "Head of Internal Audit", date: dateOnly(TODAY) }],
        }),
        "u-head",
        stamp(addDays(TODAY, -2), 10),
        "u-head",
        stamp(addDays(TODAY, -1), 10),
        stamp(addDays(TODAY, -2), 10),
      ],
    );
  }

  const demoUsers = ["u-head", "u-manager", "u-aud-01", "u-om-01", "u-rm-south-west", "u-finance", "u-exec"];
  const notificationSeeds = [
    ["critical", "Critical finding requires escalation", "A critical cash control exception was raised at Surulere outlet. Immediate review is required.", "/findings"],
    ["warning", "Corrective action overdue", "Three corrective actions have passed their target completion date.", "/actions"],
    ["info", "Audit report submitted", "A new outlet audit report has been submitted for review and approval.", "/reports"],
    ["critical", "Confidential investigation update", "A restricted investigation case has new evidence requiring review.", "/fraud"],
    ["success", "Audit plan progress", "Monthly audit plan completion is above 80% for the current period.", "/planning"],
    ["warning", "Mandatory evidence missing", "Two checklist responses require photographic evidence before submission.", "/audits"],
  ] as const;

  for (const userId of demoUsers) {
    const count = userId === "u-head" ? 10 : userId === "u-exec" ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const seed = notificationSeeds[i % notificationSeeds.length]!;
      insert(
        "INSERT INTO notifications (id, user_id, type, severity, title, body, link, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          `notif-${slug(userId)}-${i}`,
          userId,
          seed[1] === "Critical finding requires escalation" ? "escalation" : "system",
          seed[0],
          seed[1],
          seed[2],
          seed[3],
          i > 2 ? stamp(addDays(TODAY, -i), 9) : null,
          stamp(addDays(TODAY, -i - (userId === "u-head" ? 0 : 1)), 8 + i),
        ],
      );
    }
  }

  for (let i = 0; i < 10; i++) {
    insert(
      "INSERT INTO email_outbox (id, to_email, subject, body, status, created_at) VALUES (?,?,?,?,?,?)",
      [
        `email-${pad(i + 1, 3)}`,
        pick(["head.audit@crunchiesfood.com", "audit.manager@crunchiesfood.com", "regional@crunchiesfood.com"]),
        "[Crunchies Audit] Notification digest",
        "This is a seeded email notification. Configure SMTP settings to deliver live email.",
        i < 3 ? "skipped" : "skipped",
        stamp(addDays(TODAY, -i), 9),
      ],
    );
  }

  for (const userId of demoUsers.slice(0, 6)) {
    for (let i = 0; i < 4; i++) {
      insert(
        "INSERT INTO login_history (id, user_id, email, success, ip, user_agent, reason, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [
          `login-${slug(userId)}-${i}`,
          userId,
          users.find((u) => u.id === userId)?.email ?? "demo@crunchiesfood.com",
          i === 3 ? 0 : 1,
          `102.89.${randInt(1, 250)}.${randInt(1, 250)}`,
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
          i === 3 ? "Invalid password" : null,
          stamp(addDays(TODAY, -i), 7 + i),
        ],
      );
    }
  }

  const actionUsers = users.map((u) => u.id);
  const events: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string | null;
    summary: string;
    createdAt: string;
  }[] = [];
  for (let i = 0; i < 160; i++) {
    const kind = i % 12;
    const actor = pick(actionUsers);
    const createdAt = stamp(addDays(TODAY, -randInt(0, 45)), randInt(7, 20));
    if (kind === 0) events.push({ actor, action: "login.success", entityType: "session", entityId: null, summary: "User signed in to the audit platform", createdAt });
    else if (kind === 1) events.push({ actor, action: "audit.submitted", entityType: "audit", entityId: pick(audits).id, summary: "Audit submitted and locked for review", createdAt });
    else if (kind === 2) events.push({ actor, action: "audit.approved", entityType: "audit", entityId: pick(audits).id, summary: "Audit report approved by Head of Internal Audit", createdAt });
    else if (kind === 3) events.push({ actor, action: "finding.created", entityType: "finding", entityId: null, summary: "Audit finding raised from checklist exception", createdAt });
    else if (kind === 4) events.push({ actor, action: "finding.verified", entityType: "finding", entityId: null, summary: "Corrective action evidence verified by auditor", createdAt });
    else if (kind === 5) events.push({ actor, action: "action.updated", entityType: "corrective_action", entityId: null, summary: "Corrective action progress updated", createdAt });
    else if (kind === 6) events.push({ actor, action: "risk.updated", entityType: "risk", entityId: pick(riskIds), summary: "Risk assessment residual score recalculated", createdAt });
    else if (kind === 7) events.push({ actor, action: "fraud.case.viewed", entityType: "fraud_case", entityId: pick(fraudIds), summary: "Confidential fraud case accessed", createdAt });
    else if (kind === 8) events.push({ actor, action: "report.generated", entityType: "audit_report", entityId: null, summary: "Management report generated for period", createdAt });
    else if (kind === 9) events.push({ actor, action: "document.downloaded", entityType: "document", entityId: null, summary: "Evidence document downloaded", createdAt });
    else if (kind === 10) events.push({ actor, action: "control.tested", entityType: "control", entityId: pick(controlIds), summary: "Internal control operating effectiveness tested", createdAt });
    else events.push({ actor, action: "settings.viewed", entityType: "settings", entityId: null, summary: "Organisation settings reviewed", createdAt });
  }
  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let previousHash: string | null = null;
  events.forEach((event, i) => {
    const payload = {
      actorId: event.actor,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      summary: event.summary,
      metadata: null,
      ip: `102.89.${randInt(1, 250)}.${randInt(1, 250)}`,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
      createdAt: event.createdAt,
    };
    const hash = hashWithPrev(previousHash, payload);
    insert(
      "INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, summary, metadata_json, ip, user_agent, prev_hash, hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        `log-${pad(i + 1, 4)}`,
        payload.actorId,
        payload.action,
        payload.entityType,
        payload.entityId,
        payload.summary,
        null,
        payload.ip,
        payload.userAgent,
        previousHash,
        hash,
        payload.createdAt,
      ],
    );
    previousHash = hash;
  });

  for (const key of ["org", "scoring", "risk", "escalation", "approvals"] as const) {
    insert("INSERT INTO settings (key, value_json, updated_at, updated_by) VALUES (?,?,?,?)", [
      key,
      JSON.stringify(DEFAULT_SETTINGS[key]),
      stamp(TODAY, 8),
      "u-head",
    ]);
  }

  const counterKeys: [string, number][] = [
    [`audit:${YEAR}`, counters.get("audit") ?? 0],
    [`finding:${YEAR}`, counters.get("finding") ?? 0],
    [`action:${YEAR}`, counters.get("action") ?? 0],
    [`report:${YEAR}`, counters.get("report") ?? 0],
    [`fraud:${YEAR}`, counters.get("fraud") ?? 0],
    [`document:${YEAR}`, counters.get("document") ?? 0],
    [`risk:${YEAR}`, counters.get("risk") ?? 0],
  ];
  for (const [key, value] of counterKeys) {
    insert("INSERT OR REPLACE INTO counters (name, value) VALUES (?,?)", [key, value]);
  }

  return {
    users: users.length,
    outlets: outlets.length,
    audits: audits.length,
    findings: findingCount,
    risks: riskSeeds.length,
    controls: controlSeeds.length,
    fraudCases: fraudSeed.length,
    reports: reportSeq,
    documents: auditDocSeq,
  };
}
