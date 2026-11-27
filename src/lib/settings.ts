import { get, nowIso, run } from "@/db";

export const DEFAULT_SETTINGS = {
  org: {
    name: "Crunchies Fried Chicken",
    department: "Internal Audit & Internal Control",
    currency: "NGN",
    fiscalYear: new Date().getFullYear(),
    address: "Head Office, Victoria Island, Lagos, Nigeria",
  },
  scoring: {
    compliant: 100,
    partial: 50,
    noncompliant: 0,
    excludeNotApplicable: true,
  },
  risk: {
    critical: 20,
    high: 12,
    medium: 5,
    controlFactors: { strong: 25, satisfactory: 50, weak: 75, none: 100 },
  },
  escalation: {
    criticalImmediate: true,
    notifyExecutive: true,
    overdueFollowUpDays: 1,
  },
  approvals: {
    financialLimitKobo: 500_000_00,
    requireHeadForClosure: true,
  },
};

export type AppSettings = typeof DEFAULT_SETTINGS;

export function getSetting<T = unknown>(key: keyof AppSettings): T {
  const row = get<{ value_json: string }>("SELECT value_json FROM settings WHERE key = ?", [key]);
  if (!row) return DEFAULT_SETTINGS[key] as T;
  try {
    return { ...(DEFAULT_SETTINGS[key] as object), ...JSON.parse(row.value_json) } as T;
  } catch {
    return DEFAULT_SETTINGS[key] as T;
  }
}

export function setSetting(key: keyof AppSettings, value: unknown, userId?: string) {
  run(
    "INSERT INTO settings (key, value_json, updated_at, updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    [key, JSON.stringify(value), nowIso(), userId ?? null],
  );
}

export function allSettings(): AppSettings {
  return {
    org: getSetting("org"),
    scoring: getSetting("scoring"),
    risk: getSetting("risk"),
    escalation: getSetting("escalation"),
    approvals: getSetting("approvals"),
  };
}
