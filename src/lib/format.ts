export function formatMoney(kobo: number | null | undefined, compact = false) {
  const value = (kobo ?? 0) / 100;
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}m`;
    if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export function isOverdue(date: string | null | undefined, status?: string) {
  if (!date) return false;
  if (status && ["resolved", "rejected", "closed", "approved", "cancelled", "verified"].includes(status)) return false;
  return new Date(date).getTime() < new Date(new Date().toDateString()).getTime();
}

export function titleCase(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function percent(value: number | null | undefined, digits = 0) {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function truncate(value: string, max = 80) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function severityTone(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "medium":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "low":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

export function statusTone(status: string) {
  switch (status) {
    case "approved":
    case "closed":
    case "resolved":
    case "verified":
    case "effective":
    case "compliant":
    case "yes":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "in_progress":
    case "under_review":
    case "action_in_progress":
    case "awaiting_verification":
    case "submitted":
    case "partially_effective":
    case "partial":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "scheduled":
    case "management_response_pending":
    case "not_started":
    case "open":
    case "registered":
    case "not_tested":
      return "bg-slate-50 text-slate-600 ring-slate-200";
    case "overdue":
    case "critical":
    case "ineffective":
    case "noncompliant":
    case "no":
      return "bg-red-50 text-red-700 ring-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "medium":
    case "pending":
    case "skipped":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "rejected":
    case "cancelled":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

export function riskTone(rating: string) {
  switch (rating) {
    case "critical":
      return "bg-red-600 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-amber-400 text-amber-950";
    default:
      return "bg-emerald-500 text-white";
  }
}
