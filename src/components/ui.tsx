import Link from "next/link";
import { cn } from "@/lib/utils";
import { percent, severityTone, statusTone, titleCase } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card", className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h2 className="section-title">{title}</h2>
            {description ? <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger" | "success" | "warning" | "info";
  href?: string;
}) {
  const tones = {
    default: "bg-slate-100 text-slate-600",
    danger: "bg-red-50 text-red-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    info: "bg-blue-50 text-blue-600",
  };
  const body = (
    <div className={cn("kpi h-full transition", href && "hover:border-slate-300 hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <p className="kpi-label">{label}</p>
        {icon ? <span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}>{icon}</span> : null}
      </div>
      <p className="kpi-value">{value}</p>
      {hint ? <p className="mt-1 text-[10px] leading-4 text-slate-400">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    purple: "bg-violet-50 text-violet-700 ring-violet-200",
    dark: "bg-slate-900 text-white ring-slate-900",
  };
  return <span className={cn("badge", tones[tone] ?? tones.slate, className)}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cn("badge", statusTone(status))}>{label ?? titleCase(status)}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={cn("badge", severityTone(severity))}>{titleCase(severity)}</span>;
}

export function Score({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const tone = value >= 85 ? "text-emerald-700" : value >= 70 ? "text-blue-700" : value >= 55 ? "text-amber-700" : "text-red-700";
  return <span className={cn("font-semibold tabular-nums", tone)}>{percent(value, 1)}</span>;
}

export function Progress({ value, tone }: { value: number; tone?: "brand" | "green" | "amber" | "red" | "navy" }) {
  const colors = {
    brand: "bg-[#d71920]",
    green: "bg-emerald-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
    navy: "bg-slate-900",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", colors[tone ?? (value >= 85 ? "green" : value >= 50 ? "amber" : "red")])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums text-slate-500">{Math.round(value)}%</span>
    </div>
  );
}

export function FilterBar({ children, action = "" }: { children: React.ReactNode; action?: string }) {
  return (
    <form method="get" action={action} className="card mb-5 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">{children}</div>
    </form>
  );
}

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[10px] leading-4 text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-5 py-10 text-center">
      {icon ? <div className="mb-3 grid size-10 place-items-center rounded-full bg-white text-slate-400 shadow-sm">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AlertBanner({
  tone = "amber",
  title,
  children,
}: {
  tone?: "amber" | "red" | "blue" | "green";
  title: string;
  children?: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-xs leading-5 opacity-80">{children}</div> : null}
    </div>
  );
}

export function Tabs({
  tabs,
  current,
  basePath,
}: {
  tabs: { id: string; label: string; count?: number }[];
  current: string;
  basePath: string;
}) {
  return (
    <div className="no-print mb-5 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
      {tabs.map((tab) => {
        const active = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.id === "overview" ? basePath : `${basePath}?tab=${tab.id}`}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition",
              active ? "bg-[#0b1b2b] text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span className={cn("rounded-full px-1.5 text-[9px]", active ? "bg-white/15" : "bg-slate-100")}>{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatRow({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
