export const ROLE_IDS = [
  "head_audit",
  "audit_manager",
  "auditor",
  "regional_manager",
  "outlet_manager",
  "finance",
  "executive",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export const ROLE_LABELS: Record<RoleId, string> = {
  head_audit: "Head of Internal Audit",
  audit_manager: "Internal Audit Manager",
  auditor: "Internal Auditor",
  regional_manager: "Regional Manager",
  outlet_manager: "Outlet Manager",
  finance: "Finance",
  executive: "Executive Management",
};

export const PERMISSIONS = [
  "dashboard.view",
  "planning.view",
  "planning.manage",
  "audits.view",
  "audits.conduct",
  "audits.approve",
  "checklists.view",
  "checklists.manage",
  "findings.view",
  "findings.create",
  "findings.respond",
  "findings.verify",
  "findings.close",
  "risks.view",
  "risks.manage",
  "fraud.view",
  "fraud.summary",
  "fraud.manage",
  "fraud.investigate",
  "controls.view",
  "controls.test",
  "controls.manage",
  "actions.view",
  "actions.manage",
  "actions.verify",
  "actions.close",
  "reports.view",
  "reports.generate",
  "reports.approve",
  "outlets.view",
  "outlets.manage",
  "staff.view",
  "staff.manage",
  "evidence.view",
  "evidence.upload",
  "notifications.view",
  "settings.view",
  "settings.manage",
  "logs.view",
  "rankings.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  head_audit: ALL,
  audit_manager: [
    "dashboard.view",
    "planning.view",
    "planning.manage",
    "audits.view",
    "audits.conduct",
    "checklists.view",
    "findings.view",
    "findings.create",
    "findings.respond",
    "findings.verify",
    "risks.view",
    "risks.manage",
    "fraud.view",
    "fraud.manage",
    "fraud.investigate",
    "controls.view",
    "controls.test",
    "controls.manage",
    "actions.view",
    "actions.manage",
    "actions.verify",
    "reports.view",
    "reports.generate",
    "outlets.view",
    "staff.view",
    "evidence.view",
    "evidence.upload",
    "notifications.view",
    "settings.view",
    "logs.view",
    "rankings.view",
  ],
  auditor: [
    "dashboard.view",
    "planning.view",
    "audits.view",
    "audits.conduct",
    "checklists.view",
    "findings.view",
    "findings.create",
    "risks.view",
    "fraud.view",
    "fraud.investigate",
    "controls.view",
    "controls.test",
    "actions.view",
    "actions.verify",
    "reports.view",
    "outlets.view",
    "evidence.view",
    "evidence.upload",
    "notifications.view",
    "settings.view",
    "logs.view",
    "rankings.view",
  ],
  regional_manager: [
    "dashboard.view",
    "planning.view",
    "audits.view",
    "findings.view",
    "findings.respond",
    "risks.view",
    "controls.view",
    "actions.view",
    "actions.manage",
    "reports.view",
    "reports.generate",
    "outlets.view",
    "staff.view",
    "evidence.view",
    "evidence.upload",
    "notifications.view",
    "settings.view",
    "logs.view",
    "rankings.view",
  ],
  outlet_manager: [
    "dashboard.view",
    "audits.view",
    "findings.view",
    "findings.respond",
    "actions.view",
    "actions.manage",
    "reports.view",
    "outlets.view",
    "evidence.view",
    "evidence.upload",
    "notifications.view",
    "settings.view",
    "logs.view",
  ],
  finance: [
    "dashboard.view",
    "audits.view",
    "findings.view",
    "findings.respond",
    "risks.view",
    "actions.view",
    "actions.manage",
    "reports.view",
    "reports.generate",
    "outlets.view",
    "evidence.view",
    "evidence.upload",
    "notifications.view",
    "settings.view",
    "logs.view",
  ],
  executive: [
    "dashboard.view",
    "audits.view",
    "findings.view",
    "risks.view",
    "fraud.summary",
    "controls.view",
    "reports.view",
    "outlets.view",
    "notifications.view",
    "settings.view",
    "logs.view",
    "rankings.view",
  ],
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  title: string;
  initials: string;
  outlet_id: string | null;
  region_id: string | null;
  mfa_enabled: number;
};

export function permissionsFor(role: RoleId): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(user: { role: RoleId } | null | undefined, permission: Permission) {
  if (!user) return false;
  return permissionsFor(user.role).includes(permission);
}

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Command centre",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "gauge", permission: "dashboard.view" },
      { href: "/planning", label: "Audit Planning", icon: "calendar", permission: "planning.view" },
      { href: "/audits", label: "Outlet Audits", icon: "clipboard", permission: "audits.view" },
      { href: "/checklists", label: "Audit Checklist", icon: "list", permission: "checklists.view" },
    ],
  },
  {
    label: "Assurance",
    items: [
      { href: "/findings", label: "Audit Findings", icon: "flag", permission: "findings.view" },
      { href: "/risks", label: "Risk Register", icon: "shield", permission: "risks.view" },
      { href: "/fraud", label: "Fraud Investigation", icon: "lock", permission: "fraud.view" },
      { href: "/controls", label: "Internal Controls", icon: "sliders", permission: "controls.view" },
      { href: "/actions", label: "Corrective Actions", icon: "check", permission: "actions.view" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/outlets", label: "Outlet Management", icon: "building", permission: "outlets.view" },
      { href: "/staff", label: "Staff & Auditors", icon: "users", permission: "staff.view" },
      { href: "/reports", label: "Audit Reports", icon: "file", permission: "reports.view" },
      { href: "/evidence", label: "Evidence Repository", icon: "folder", permission: "evidence.view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/notifications", label: "Notifications", icon: "bell", permission: "notifications.view" },
      { href: "/settings", label: "Settings", icon: "settings", permission: "settings.view" },
      { href: "/logs", label: "Activity Logs", icon: "history", permission: "logs.view" },
    ],
  },
];

export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/dashboard": "dashboard.view",
  "/planning": "planning.view",
  "/audits": "audits.view",
  "/checklists": "checklists.view",
  "/findings": "findings.view",
  "/risks": "risks.view",
  "/fraud": "fraud.view",
  "/controls": "controls.view",
  "/actions": "actions.view",
  "/reports": "reports.view",
  "/outlets": "outlets.view",
  "/staff": "staff.view",
  "/evidence": "evidence.view",
  "/notifications": "notifications.view",
  "/settings": "settings.view",
  "/logs": "logs.view",
  "/rankings": "rankings.view",
};

export function permissionForPath(pathname: string): Permission | null {
  let best: Permission | null = null;
  let bestLength = -1;
  for (const [prefix, permission] of Object.entries(ROUTE_PERMISSION)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (prefix.length > bestLength) {
        best = permission;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

export function homeForRole(role: RoleId) {
  if (role === "executive") return "/dashboard";
  return "/dashboard";
}
