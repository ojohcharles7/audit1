import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime, titleCase } from "@/lib/format";
import { KpiCard, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { markAllReadAction, markNotificationReadAction } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("notifications.view");
  const sp = await searchParams;
  const unread = sp.unread === "1";
  const notifications = all<{ id: string; type: string; severity: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }>(
    `SELECT * FROM notifications WHERE user_id=? AND (? = 0 OR read_at IS NULL) ORDER BY created_at DESC LIMIT 100`,
    [user.id, unread ? 1 : 0],
  );
  const allCount = all<{ c: number }>("SELECT count(*) c FROM notifications WHERE user_id=?", [user.id])[0]?.c ?? 0;
  const unreadCount = all<{ c: number }>("SELECT count(*) c FROM notifications WHERE user_id=? AND read_at IS NULL", [user.id])[0]?.c ?? 0;
  return (
    <div>
      <PageHeader eyebrow="Notification centre" title="Notifications" description="Audit assignments, report approvals, critical findings, overdue actions and investigation alerts." actions={unreadCount ? <form action={markAllReadAction}><SubmitButton className="btn-secondary"><CheckCheck className="size-4" /> Mark all read</SubmitButton></form> : null} />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><KpiCard label="All notifications" value={allCount} icon={<Bell className="size-4" />} /><KpiCard label="Unread" value={unreadCount} tone="danger" /><KpiCard label="Email outbox" value="In-app + SMTP ready" tone="info" hint="Configure SMTP in environment" /></section>
      <div className="mb-3 flex gap-2"><Link href="/notifications" className={`btn-secondary btn-sm ${!unread ? "!bg-slate-900 !text-white" : ""}`}>All</Link><Link href="/notifications?unread=1" className={`btn-secondary btn-sm ${unread ? "!bg-slate-900 !text-white" : ""}`}>Unread</Link></div>
      <Panel title={unread ? "Unread notifications" : "Recent notifications"}>
        <ul className="divide-y divide-slate-100">
          {notifications.map((notification) => (
            <li key={notification.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 ${notification.read_at ? "" : "bg-red-50/30"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><span className={`badge ${notification.severity === "critical" ? "bg-red-50 text-red-700 ring-red-200" : notification.severity === "warning" ? "bg-amber-50 text-amber-700 ring-amber-200" : notification.severity === "success" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-blue-50 text-blue-700 ring-blue-200"}`}>{titleCase(notification.severity)}</span><span className="text-[10px] text-slate-400">{formatDateTime(notification.created_at)}</span>{!notification.read_at ? <span className="size-1.5 rounded-full bg-red-600" /> : null}</div>
                <p className="mt-1 text-xs font-semibold text-slate-800">{notification.title}</p>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{notification.body}</p>
              </div>
              <div className="flex items-center gap-2">
                {notification.link ? <Link href={notification.link} className="btn-secondary btn-sm">Open</Link> : null}
                {!notification.read_at ? <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={notification.id} /><input type="hidden" name="link" value={notification.link ?? "/notifications"} /><SubmitButton className="btn-ghost btn-sm">Mark read</SubmitButton></form> : null}
              </div>
            </li>
          ))}
          {!notifications.length ? <li className="py-6 text-center text-sm text-slate-500">You are all caught up.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}
