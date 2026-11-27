import Link from "next/link";
import { Fingerprint, History, MonitorSmartphone } from "lucide-react";
import { all } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { verifyActivityChain } from "@/lib/activity";
import { formatDateTime, titleCase } from "@/lib/format";
import { AlertBanner, KpiCard, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Activity logs" };

export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("logs.view");
  const sp = await searchParams;
  const tab = sp.tab === "logins" ? "logins" : "activity";
  const q = typeof sp.q === "string" ? sp.q : "";
  const canSeeAll = ["head_audit", "audit_manager", "executive"].includes(user.role);
  const chain = await verifyActivityChain();
  const logs = await all<{ id: string; actor_name: string | null; actor_role: string | null; action: string; entity_type: string; entity_id: string | null; summary: string; ip: string | null; user_agent: string | null; hash: string; created_at: string }>(
    `SELECT l.*, u.name actor_name, u.role actor_role FROM activity_logs l LEFT JOIN users u ON u.id=l.actor_id
     WHERE (? = 1 OR l.actor_id = ?) AND (? = '' OR l.action LIKE ? OR l.summary LIKE ? OR u.name LIKE ?)
     ORDER BY l.created_at DESC LIMIT 200`,
    [canSeeAll ? 1 : 0, user.id, q, `%${q}%`, `%${q}%`, `%${q}%`],
  );
  const logins = await all<{ id: string; email: string; success: number; ip: string | null; user_agent: string | null; reason: string | null; created_at: string }>(
    `SELECT * FROM login_history WHERE (? = 1 OR user_id = ?) ORDER BY created_at DESC LIMIT 100`,
    [canSeeAll ? 1 : 0, user.id],
  );
  return (
    <div>
      <PageHeader eyebrow="Security & audit trail" title="Activity logs" description="Append-only record of important actions, approvals, record changes, downloads and sign-ins." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={chain.valid ? "badge bg-emerald-50 text-emerald-700 ring-emerald-200" : "badge bg-red-50 text-red-700 ring-red-200"}><Fingerprint className="size-3" /> Hash chain {chain.valid ? "verified" : `broken at ${chain.brokenAt}`}</span>
        <span className="text-[10px] text-slate-400">{chain.count} activity entries · tamper-evident chain</span>
      </div>
      {!chain.valid ? <div className="mb-4"><AlertBanner tone="red" title="Activity chain integrity warning">Investigate possible tampering immediately.</AlertBanner></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><KpiCard label="Activity entries" value={logs.length} icon={<History className="size-4" />} /><KpiCard label="Sign-in records" value={logins.length} icon={<MonitorSmartphone className="size-4" />} /><KpiCard label="Successful sign-ins" value={logins.filter((l) => l.success).length} tone="success" /><KpiCard label="Failed sign-ins" value={logins.filter((l) => !l.success).length} tone="danger" /></section>
      <div className="mb-3 flex gap-2"><Link href="/logs" className={`btn-secondary btn-sm ${tab === "activity" ? "!bg-slate-900 !text-white" : ""}`}>Activity</Link><Link href="/logs?tab=logins" className={`btn-secondary btn-sm ${tab === "logins" ? "!bg-slate-900 !text-white" : ""}`}>Login history</Link></div>
      {tab === "activity" ? (
        <Panel title="Activity trail" description="Actor, action, entity and network metadata are retained for every important event.">
          <form method="get" className="mb-3"><input name="q" defaultValue={q} placeholder="Search action, summary or actor" className="input max-w-sm" /></form>
          <div className="table-wrap"><table className="table min-w-[980px]"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Summary</th><th>Entity</th><th>Network</th><th>Hash</th></tr></thead><tbody>
            {logs.map((log) => (<tr key={log.id}><td className="whitespace-nowrap text-[10px] text-slate-500">{formatDateTime(log.created_at)}</td><td className="text-xs">{log.actor_name ?? "System"}<p className="text-[9px] text-slate-400">{log.actor_role ? titleCase(log.actor_role) : "—"}</p></td><td className="font-mono text-[10px] text-slate-600">{log.action}</td><td className="max-w-80 text-xs text-slate-600">{log.summary}</td><td className="text-[10px] text-slate-400">{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}</td><td className="text-[10px] text-slate-400">{log.ip ?? "—"}<p className="max-w-48 truncate">{log.user_agent ?? ""}</p></td><td className="max-w-32 truncate font-mono text-[8px] text-slate-300">{log.hash}</td></tr>))}
          </tbody></table></div>
        </Panel>
      ) : (
        <Panel title="Login history" description="Successful and failed sign-in attempts with IP and device information.">
          <div className="table-wrap"><table className="table min-w-[760px]"><thead><tr><th>When</th><th>Account</th><th>Result</th><th>IP</th><th>Device</th><th>Reason</th></tr></thead><tbody>
            {logins.map((login) => (<tr key={login.id}><td className="text-[10px] text-slate-500">{formatDateTime(login.created_at)}</td><td className="text-xs">{login.email}</td><td><span className={`badge ${login.success ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>{login.success ? "Success" : "Failed"}</span></td><td className="text-xs">{login.ip ?? "—"}</td><td className="max-w-64 truncate text-[10px] text-slate-400">{login.user_agent ?? "—"}</td><td className="text-[10px] text-slate-500">{login.reason ?? "—"}</td></tr>))}
          </tbody></table></div>
        </Panel>
      )}
    </div>
  );
}
