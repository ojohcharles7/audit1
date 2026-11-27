export const AUDIT_CATEGORIES = [
  { id: "financial", label: "Financial & Cash Management", short: "Financial" },
  { id: "inventory", label: "Inventory & Stock", short: "Inventory" },
  { id: "procurement", label: "Procurement & Purchasing", short: "Procurement" },
  { id: "operational", label: "Operational", short: "Operations" },
  { id: "it", label: "IT & Technology", short: "IT" },
  { id: "hr", label: "Human Resources & Payroll", short: "HR & Payroll" },
  { id: "asset", label: "Asset Management", short: "Assets" },
  { id: "compliance", label: "Regulatory & Compliance", short: "Compliance" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["id"];

export function categoryLabel(id: string) {
  return AUDIT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const SEVERITIES = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "observation", label: "Observation" },
] as const;

export const FINDING_STATUSES = [
  { id: "open", label: "Open" },
  { id: "under_review", label: "Under Review" },
  { id: "management_response_pending", label: "Management Response Pending" },
  { id: "action_in_progress", label: "Action in Progress" },
  { id: "awaiting_verification", label: "Awaiting Verification" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected with Justification" },
  { id: "overdue", label: "Overdue" },
] as const;

export const AUDIT_STATUSES = [
  { id: "scheduled", label: "Scheduled" },
  { id: "in_progress", label: "In Progress" },
  { id: "submitted", label: "Submitted" },
  { id: "under_review", label: "Under Review" },
  { id: "approved", label: "Approved" },
  { id: "closed", label: "Closed" },
  { id: "overdue", label: "Overdue" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export const ACTION_STATUSES = [
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "awaiting_verification", label: "Awaiting Verification" },
  { id: "verified", label: "Verified" },
  { id: "closed", label: "Closed" },
] as const;

export const RISK_CATEGORIES = [
  "Financial",
  "Operational",
  "Fraud",
  "Inventory",
  "Compliance",
  "IT & Cyber",
  "Human Resources",
  "Reputational",
] as const;

export const FRAUD_TYPES = [
  "Cash theft",
  "Sales manipulation",
  "POS manipulation",
  "Inventory theft",
  "Fictitious purchases",
  "Supplier fraud",
  "Payroll fraud",
  "Expense fraud",
  "Unauthorised discounts",
  "Refund manipulation",
  "Management misconduct",
  "Asset theft",
  "Document falsification",
] as const;

export const AUDIT_TYPES = [
  { id: "routine", label: "Routine Outlet Audit" },
  { id: "surprise", label: "Surprise Audit" },
  { id: "follow_up", label: "Follow-up Audit" },
  { id: "financial", label: "Financial Audit" },
  { id: "inventory", label: "Inventory Audit" },
  { id: "procurement", label: "Procurement Audit" },
  { id: "operational", label: "Operational Audit" },
  { id: "it", label: "IT & Technology Audit" },
  { id: "hr", label: "HR & Payroll Audit" },
  { id: "asset", label: "Asset Audit" },
  { id: "compliance", label: "Compliance Audit" },
] as const;

export const CONTROL_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually", "Per transaction"] as const;
export const CONTROL_EFFECTIVENESS = ["effective", "partially_effective", "ineffective", "not_tested"] as const;
export const RISK_EFFECTIVENESS = ["strong", "satisfactory", "weak", "none"] as const;

export const DEPARTMENTS = [
  "Operations",
  "Finance",
  "Inventory",
  "Procurement",
  "Information Technology",
  "Human Resources",
  "Facilities & Assets",
  "Compliance",
] as const;

export const FINDING_BY_CATEGORY: Record<string, string> = {
  financial: "Finance",
  inventory: "Inventory",
  procurement: "Procurement",
  operational: "Operations",
  it: "Information Technology",
  hr: "Human Resources",
  asset: "Facilities & Assets",
  compliance: "Compliance",
};

export const DEMO_PASSWORD = "Audit@2026";
export const DEMO_ACCOUNTS = [
  { role: "Head of Internal Audit", email: "head.audit@crunchiesfood.com", name: "Ngozi Adeyemi" },
  { role: "Internal Audit Manager", email: "audit.manager@crunchiesfood.com", name: "Ibrahim Bello" },
  { role: "Internal Auditor", email: "auditor@crunchiesfood.com", name: "Tolu Ajayi" },
  { role: "Regional Manager", email: "regional@crunchiesfood.com", name: "Emeka Obi" },
  { role: "Outlet Manager", email: "outlet@crunchiesfood.com", name: "Kemi Alabi" },
  { role: "Finance", email: "finance@crunchiesfood.com", name: "Grace Eze" },
  { role: "Executive Management", email: "executive@crunchiesfood.com", name: "Dr. Ada Nwosu" },
];
