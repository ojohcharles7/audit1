CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS states (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  region_id TEXT NOT NULL REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS outlets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  state_id TEXT NOT NULL REFERENCES states(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  manager_id TEXT,
  assistant_manager TEXT,
  employee_count INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  opened_at TEXT,
  risk_rating TEXT NOT NULL DEFAULT 'medium',
  compliance_status TEXT NOT NULL DEFAULT 'pending',
  last_audit_score REAL,
  last_audit_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT NOT NULL,
  phone TEXT,
  initials TEXT NOT NULL,
  outlet_id TEXT REFERENCES outlets(id),
  region_id TEXT REFERENCES regions(id),
  status TEXT NOT NULL DEFAULT 'active',
  mfa_secret TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_id TEXT NOT NULL UNIQUE,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  success INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_templates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_questions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  control_objective TEXT,
  procedure TEXT,
  expected_control TEXT,
  response_type TEXT NOT NULL DEFAULT 'compliance',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  evidence_required TEXT NOT NULL DEFAULT 'none',
  weight INTEGER NOT NULL DEFAULT 1,
  mandatory INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  template_id TEXT NOT NULL REFERENCES audit_templates(id),
  audit_type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  auditor_id TEXT NOT NULL REFERENCES users(id),
  manager_id TEXT REFERENCES users(id),
  planned_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  objectives TEXT,
  scope TEXT,
  methodology TEXT,
  score REAL,
  compliance_rate REAL,
  risk_rating TEXT,
  submitted_at TEXT,
  locked_at TEXT,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  recurrence_group TEXT
);

CREATE TABLE IF NOT EXISTS audit_responses (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES checklist_questions(id),
  result TEXT,
  score_awarded REAL,
  numeric_value REAL,
  text_value TEXT,
  amount_kobo INTEGER,
  comment TEXT,
  answered_by TEXT REFERENCES users(id),
  answered_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (audit_id, question_id)
);

CREATE TABLE IF NOT EXISTS audit_response_documents (
  response_id TEXT NOT NULL REFERENCES audit_responses(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  PRIMARY KEY (response_id, document_id)
);

CREATE TABLE IF NOT EXISTS audit_schedules (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  template_id TEXT NOT NULL REFERENCES audit_templates(id),
  auditor_id TEXT NOT NULL REFERENCES users(id),
  frequency TEXT NOT NULL,
  next_date TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  audit_id TEXT REFERENCES audits(id),
  outlet_id TEXT NOT NULL REFERENCES outlets(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expected_control TEXT,
  actual_observation TEXT,
  root_cause TEXT,
  recommendation TEXT,
  financial_impact_kobo INTEGER NOT NULL DEFAULT 0,
  severity TEXT NOT NULL,
  risk_score INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  management_response TEXT,
  responsible_user_id TEXT REFERENCES users(id),
  target_date TEXT,
  is_repeated INTEGER NOT NULL DEFAULT 0,
  source_response_id TEXT REFERENCES audit_responses(id),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  closed_by TEXT REFERENCES users(id),
  closed_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS finding_history (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corrective_actions (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  department TEXT,
  officer_id TEXT NOT NULL REFERENCES users(id),
  due_date TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started',
  management_comments TEXT,
  evidence_document_id TEXT,
  verified_by TEXT REFERENCES users(id),
  verification_note TEXT,
  verified_at TEXT,
  closed_by TEXT REFERENCES users(id),
  closed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  outlet_id TEXT REFERENCES outlets(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cause TEXT,
  likelihood INTEGER NOT NULL,
  impact INTEGER NOT NULL,
  inherent_score INTEGER NOT NULL,
  existing_controls TEXT,
  control_effectiveness TEXT NOT NULL DEFAULT 'satisfactory',
  residual_score INTEGER NOT NULL,
  rating TEXT NOT NULL,
  owner_id TEXT REFERENCES users(id),
  mitigation TEXT,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS controls (
  id TEXT PRIMARY KEY,
  control_ref TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  objective TEXT,
  owner_id TEXT REFERENCES users(id),
  department TEXT NOT NULL,
  frequency TEXT NOT NULL,
  test_procedure TEXT,
  evidence_required TEXT,
  effectiveness TEXT NOT NULL DEFAULT 'not_tested',
  last_tested_at TEXT,
  next_test_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_tests (
  id TEXT PRIMARY KEY,
  control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  audit_id TEXT REFERENCES audits(id),
  tester_id TEXT REFERENCES users(id),
  tested_at TEXT NOT NULL,
  result TEXT NOT NULL,
  sample_size INTEGER,
  exceptions INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fraud_cases (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  officer_id TEXT NOT NULL REFERENCES users(id),
  outlet_id TEXT REFERENCES outlets(id),
  suspected_exposure_kobo INTEGER NOT NULL DEFAULT 0,
  incident_date TEXT NOT NULL,
  location TEXT,
  witnesses TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  conclusion TEXT,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  closure_approved_by TEXT REFERENCES users(id),
  closure_approved_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  restricted INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fraud_updates (
  seq BIGSERIAL NOT NULL,
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES fraud_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  occurred_at TEXT NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS case_access (
  case_id TEXT NOT NULL REFERENCES fraud_cases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL,
  PRIMARY KEY (case_id, user_id)
);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  finding_id TEXT REFERENCES findings(id),
  case_id TEXT REFERENCES fraud_cases(id),
  level TEXT NOT NULL,
  reason TEXT NOT NULL,
  escalated_to TEXT NOT NULL,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  outlet_id TEXT REFERENCES outlets(id),
  audit_id TEXT REFERENCES audits(id),
  finding_id TEXT REFERENCES findings(id),
  fraud_case_id TEXT REFERENCES fraud_cases(id),
  action_id TEXT REFERENCES corrective_actions(id),
  category TEXT NOT NULL DEFAULT 'general',
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  description TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS document_access_log (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  report_ref TEXT NOT NULL UNIQUE,
  audit_id TEXT REFERENCES audits(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  confidentiality TEXT NOT NULL DEFAULT 'confidential',
  snapshot_json TEXT NOT NULL,
  generated_by TEXT REFERENCES users(id),
  generated_at TEXT NOT NULL,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  emailed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  seq BIGSERIAL NOT NULL,
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  ip TEXT,
  user_agent TEXT,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outlets_region ON outlets(region_id);
CREATE INDEX IF NOT EXISTS idx_outlets_state ON outlets(state_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audits_outlet ON audits(outlet_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(planned_date);
CREATE INDEX IF NOT EXISTS idx_responses_audit ON audit_responses(audit_id);
CREATE INDEX IF NOT EXISTS idx_findings_outlet ON findings(outlet_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_actions_finding ON corrective_actions(finding_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_audit ON documents(audit_id);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(fraud_case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE OR REPLACE FUNCTION deny_activity_mutation() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'activity logs are append-only';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_no_update ON activity_logs;
CREATE TRIGGER trg_activity_no_update BEFORE UPDATE ON activity_logs FOR EACH ROW EXECUTE FUNCTION deny_activity_mutation();
DROP TRIGGER IF EXISTS trg_activity_no_delete ON activity_logs;
CREATE TRIGGER trg_activity_no_delete BEFORE DELETE ON activity_logs FOR EACH ROW EXECUTE FUNCTION deny_activity_mutation();

CREATE OR REPLACE FUNCTION deny_fraud_update_mutation() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'fraud investigation updates are append-only';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fraud_updates_no_update ON fraud_updates;
CREATE TRIGGER trg_fraud_updates_no_update BEFORE UPDATE ON fraud_updates FOR EACH ROW EXECUTE FUNCTION deny_fraud_update_mutation();
DROP TRIGGER IF EXISTS trg_fraud_updates_no_delete ON fraud_updates;
CREATE TRIGGER trg_fraud_updates_no_delete BEFORE DELETE ON fraud_updates FOR EACH ROW EXECUTE FUNCTION deny_fraud_update_mutation();

CREATE OR REPLACE FUNCTION deny_locked_response() RETURNS trigger AS $fn$
DECLARE
  target_audit TEXT;
BEGIN
  target_audit := COALESCE(NEW.audit_id, OLD.audit_id);
  IF (SELECT locked_at FROM audits WHERE id = target_audit) IS NOT NULL THEN
    RAISE EXCEPTION 'audit is submitted and locked';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_responses_no_insert_locked ON audit_responses;
CREATE TRIGGER trg_responses_no_insert_locked BEFORE INSERT ON audit_responses FOR EACH ROW EXECUTE FUNCTION deny_locked_response();
DROP TRIGGER IF EXISTS trg_responses_no_update_locked ON audit_responses;
CREATE TRIGGER trg_responses_no_update_locked BEFORE UPDATE ON audit_responses FOR EACH ROW EXECUTE FUNCTION deny_locked_response();
DROP TRIGGER IF EXISTS trg_responses_no_delete_locked ON audit_responses;
CREATE TRIGGER trg_responses_no_delete_locked BEFORE DELETE ON audit_responses FOR EACH ROW EXECUTE FUNCTION deny_locked_response();

CREATE OR REPLACE FUNCTION deny_report_delete() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'audit reports are permanent records';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reports_no_delete ON audit_reports;
CREATE TRIGGER trg_reports_no_delete BEFORE DELETE ON audit_reports FOR EACH ROW EXECUTE FUNCTION deny_report_delete();
