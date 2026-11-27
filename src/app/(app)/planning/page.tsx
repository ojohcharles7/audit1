import Link from "next/link";
import { DATE_PLUS_30, DATE_PLUS_7, DATE_PLUS_14, CURRENT_MONTH, DATE_TODAY } from "@/lib/defaults";
import { CalendarClock, ChevronLeft, ChevronRight, ListChecks, Plus, Repeat2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getScope } from "@/lib/scope";
import { auditors, outletsForScope, templates } from "@/lib/data/lookups";
import { auditSchedules, planningAudits, scheduledCalendar } from "@/lib/data/audits";
import { AUDIT_TYPES } from "@/lib/constants";
import { formatDate, isOverdue, titleCase } from "@/lib/format";
import { AlertBanner, EmptyState, KpiCard, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createAuditAction, createRecurringScheduleAction } from "./actions";

export const metadata = { title: "Audit planning" };

function monthBounds(month: string) {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(year!, (m ?? 1) - 1, 1);
  const last = new Date(year!, m ?? 1, 0);
  return { first, last, days: last.getDate(), startDay: first.getDay() };
}

function addMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year!, (m ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("planning.view");
  const scope = getScope(user);
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : CURRENT_MONTH;
  const { first, days, startDay } = monthBounds(month);
  const calendarAudits = scheduledCalendar(scope, month);
  const tasks = planningAudits(scope);
  const schedules = auditSchedules(scope);
  const outlets = outletsForScope(scope);
  const templateOptions = templates();
  const auditorOptions = auditors();
  const manageable = can(user, "planning.manage");
  const monthLabel = first.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const cells: (number | null)[] = [...Array(startDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const selectedOutlet = typeof sp.outlet === "string" ? sp.outlet : "";
  const overdue = tasks.filter((audit) => isOverdue(audit.due_date, audit.status));

  return (
    <div>
      <PageHeader
        eyebrow="Annual plan · quarterly plan · fieldwork"
        title="Audit planning & scheduling"
        description="Plan announced and surprise audits, assign auditors, manage recurring schedules and track delivery."
        actions={
          manageable ? (
            <a href="#schedule" className="btn-primary"><Plus className="size-4" /> New audit</a>
          ) : null
        }
      />

      {typeof sp.error === "string" ? <div className="mb-4"><AlertBanner tone="red" title={sp.error} /></div> : null}
      {sp.scheduled === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Recurring schedule created">Future occurrences are available in the schedule register.</AlertBanner></div> : null}
      {sp.cancelled === "1" ? <div className="mb-4"><AlertBanner tone="amber" title="Audit cancelled">The audit has been removed from active fieldwork.</AlertBanner></div> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Audits this month" value={calendarAudits.length} icon={<CalendarClock className="size-4" />} />
        <KpiCard label="Active plan items" value={tasks.length} icon={<ListChecks className="size-4" />} tone="info" />
        <KpiCard label="Overdue" value={overdue.length} icon={<CalendarClock className="size-4" />} tone="danger" />
        <KpiCard label="Recurring schedules" value={schedules.filter((schedule) => schedule.active).length} icon={<Repeat2 className="size-4" />} tone="success" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel
            title={monthLabel}
            description="Audits are plotted on their planned fieldwork date."
            action={
              <div className="flex items-center gap-1">
                <Link href={`/planning?month=${addMonth(month, -1)}`} className="btn-secondary btn-sm" aria-label="Previous month"><ChevronLeft className="size-3.5" /></Link>
                <Link href={`/planning?month=${CURRENT_MONTH}`} className="btn-secondary btn-sm">Today</Link>
                <Link href={`/planning?month=${addMonth(month, 1)}`} className="btn-secondary btn-sm" aria-label="Next month"><ChevronRight className="size-3.5" /></Link>
              </div>
            }
          >
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="pb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{day}</div>
              ))}
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="min-h-24 rounded-lg bg-slate-50/40" />;
                const date = `${month}-${String(day).padStart(2, "0")}`;
                const dayAudits = calendarAudits.filter((audit) => audit.planned_date === date);
                const isToday = date === DATE_TODAY;
                return (
                  <div key={date} className={`min-h-24 rounded-lg border p-1.5 text-left ${isToday ? "border-[#d71920] bg-red-50/40" : "border-slate-100 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold ${isToday ? "text-[#d71920]" : "text-slate-400"}`}>{day}</span>
                      {dayAudits.length ? <span className="rounded-full bg-slate-900 px-1 text-[8px] font-bold text-white">{dayAudits.length}</span> : null}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayAudits.slice(0, 3).map((audit) => (
                        <Link key={audit.id} href={`/audits/${audit.id}`} className="block truncate rounded bg-slate-50 px-1 py-0.5 text-[9px] font-medium text-slate-700 hover:bg-slate-100">
                          {audit.outlet_name}
                        </Link>
                      ))}
                      {dayAudits.length > 3 ? <p className="text-[8px] text-slate-400">+{dayAudits.length - 3} more</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Task view" description="Upcoming and recent audits ordered by planned date.">
            <div className="space-y-2">
              {tasks.map((audit) => (
                <div key={audit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/audits/${audit.id}`} className="block truncate text-xs font-medium text-slate-800 hover:underline">{audit.title}</Link>
                    <p className="text-[10px] text-slate-400">{audit.ref} · {audit.outlet_name} · {audit.auditor_name} · {formatDate(audit.planned_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={isOverdue(audit.due_date, audit.status) && audit.status !== "overdue" ? "overdue" : audit.status} />
                    {manageable && ["scheduled", "overdue"].includes(audit.status) ? (
                      <a href={`/audits/${audit.id}`} className="text-[10px] font-semibold text-slate-500 hover:underline">Manage</a>
                    ) : null}
                  </div>
                </div>
              ))}
              {tasks.length === 0 ? <EmptyState title="No audits in the plan" description="Schedule an audit to begin building the plan." /> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {manageable ? (
            <Panel title="Schedule an audit" description="Create a single audit or a monthly/quarterly series.">
              <form action={createAuditAction} id="schedule" className="grid gap-3">
                <div><label className="label">Outlet</label><select name="outletId" required className="select" defaultValue={selectedOutlet}><option value="">Select outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name} · {outlet.code}</option>)}</select></div>
                <div><label className="label">Checklist template</label><select name="templateId" required className="select"><option value="">Select template</option>{templateOptions.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
                <div><label className="label">Auditor</label><select name="auditorId" required className="select"><option value="">Assign auditor</option>{auditorOptions.map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Audit type</label><select name="auditType" className="select">{AUDIT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></div>
                  <div><label className="label">Category</label><select name="category" className="select" disabled><option>From template</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Planned date</label><input name="plannedDate" type="date" required className="input" defaultValue={DATE_PLUS_7} /></div>
                  <div><label className="label">Due date</label><input name="dueDate" type="date" required className="input" defaultValue={DATE_PLUS_14} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Repeat</label><select name="repeat" className="select"><option value="none">One-off</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></div>
                  <div><label className="label">Occurrences</label><input name="occurrences" type="number" min="1" max="12" defaultValue="3" className="input" /></div>
                </div>
                <div><label className="label">Objectives</label><textarea name="objectives" rows={2} className="textarea min-h-16" placeholder="What should the audit achieve?" /></div>
                <div><label className="label">Scope</label><textarea name="scope" rows={2} className="textarea min-h-16" placeholder="Records, processes, period and locations" /></div>
                <SubmitButton className="btn-primary">Schedule audit</SubmitButton>
              </form>
            </Panel>
          ) : (
            <Panel title="Audit plan" description="You have view-only access to the plan.">
              <p className="text-xs leading-5 text-slate-500">Contact the Head of Internal Audit to schedule or amend audits.</p>
            </Panel>
          )}

          {manageable ? (
            <Panel title="Recurring schedule" description="Register a recurring cadence for future planning.">
              <form action={createRecurringScheduleAction} className="grid gap-2">
                <select name="outletId" required className="select"><option value="">Outlet</option>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select>
                <select name="templateId" required className="select"><option value="">Template</option>{templateOptions.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
                <select name="auditorId" required className="select"><option value="">Auditor</option>{auditorOptions.map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">
                  <select name="frequency" className="select"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select>
                  <input name="nextDate" type="date" required className="input" defaultValue={DATE_PLUS_30} />
                </div>
                <SubmitButton className="btn-secondary">Create schedule</SubmitButton>
              </form>
            </Panel>
          ) : null}

          <Panel title="Standing schedules" description="Recurring audit cadences in the plan.">
            <ul className="divide-y divide-slate-100">
              {schedules.map((schedule) => (
                <li key={schedule.id} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-[11px] font-medium text-slate-800">{schedule.outlet_name}</p>
                  <p className="text-[10px] text-slate-400">{titleCase(schedule.frequency)} · next {formatDate(schedule.next_date)} · {schedule.auditor_name}</p>
                </li>
              ))}
              {schedules.length === 0 ? <li className="py-2 text-xs text-slate-500">No recurring schedules.</li> : null}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
