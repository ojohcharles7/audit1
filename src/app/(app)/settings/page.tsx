import Link from "next/link";
import { KeyRound, Laptop, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { all, get } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { allSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { AlertBanner, DetailList, KpiCard, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { beginMfaAction, changePasswordAction, confirmMfaAction, disableMfaAction, processEmailsAction, resetDemoAction, revokeSessionAction, updateProfileSettingsAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("settings.view");
  const sp = await searchParams;
  const settings = await allSettings();
  const full = await get<{ mfa_enabled: number; mfa_secret: string | null; last_login_at: string | null }>("SELECT mfa_enabled, mfa_secret, last_login_at FROM users WHERE id=?", [user.id]);
  const sessions = await all<{ id: string; ip: string | null; user_agent: string | null; created_at: string; last_seen_at: string; expires_at: string }>("SELECT * FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC", [user.id, new Date().toISOString()]);
  const outbox = await all<{ status: string; c: number }>("SELECT status, count(*) c FROM email_outbox GROUP BY status");
  const pendingEmails = outbox.find((row) => row.status === "pending")?.c ?? 0;
  const manage = can(user, "settings.manage");
  const mfaUri = typeof sp.uri === "string" ? sp.uri : null;
  const qr = mfaUri ? await QRCode.toDataURL(mfaUri, { margin: 1, width: 180 }) : null;
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Settings" description="Organisation profile, audit scoring, multi-factor authentication, sessions and demo controls." />
      {sp.saved === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Settings saved" /></div> : null}
      {sp.password === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Password changed and other sessions revoked" /></div> : null}
      {sp.mfa === "enabled" ? <div className="mb-4"><AlertBanner tone="green" title="Multi-factor authentication enabled" /></div> : null}
      {sp.mfa === "disabled" ? <div className="mb-4"><AlertBanner tone="amber" title="Multi-factor authentication disabled" /></div> : null}
      {sp.sessions === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Session revoked" /></div> : null}
      {sp.reset === "1" ? <div className="mb-4"><AlertBanner tone="green" title="Demo data reset" /></div> : null}
      {sp.error ? <div className="mb-4"><AlertBanner tone="red" title={String(sp.error)} /></div> : null}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Your role" value={ROLE_LABELS[user.role]} icon={<ShieldCheck className="size-4" />} />
        <KpiCard label="MFA" value={full?.mfa_enabled ? "Enabled" : "Off"} tone={full?.mfa_enabled ? "success" : "warning"} icon={<KeyRound className="size-4" />} />
        <KpiCard label="Active sessions" value={sessions.length} icon={<Laptop className="size-4" />} />
        <KpiCard label="Pending emails" value={pendingEmails} tone="info" icon={<Mail className="size-4" />} />
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Account" description="Your identity and role."><DetailList items={[{ label: "Name", value: user.name }, { label: "Email", value: user.email }, { label: "Role", value: ROLE_LABELS[user.role] }, { label: "Title", value: user.title }, { label: "Last login", value: formatDateTime(full?.last_login_at) }]} /></Panel>
        <Panel title="Change password" description="Other active sessions are revoked when your password changes.">
          <form action={changePasswordAction} className="grid gap-2 sm:grid-cols-2"><input name="currentPassword" type="password" required placeholder="Current password" className="input" /><input name="newPassword" type="password" required minLength={8} placeholder="New password (min 8)" className="input" /><div className="sm:col-span-2"><SubmitButton className="btn-primary">Change password</SubmitButton></div></form>
        </Panel>
        <Panel title="Multi-factor authentication" description="Optional TOTP authenticator for privileged accounts.">
          {full?.mfa_enabled ? (
            <div className="space-y-3"><p className="flex items-center gap-2 text-xs text-emerald-700"><ShieldCheck className="size-4" /> Authenticator protection is active.</p><form action={disableMfaAction} className="flex flex-wrap gap-2"><input name="password" type="password" required placeholder="Confirm password to disable" className="input max-w-64" /><SubmitButton className="btn-secondary">Disable MFA</SubmitButton></form></div>
          ) : sp.mfa === "pending" && qr ? (
            <div className="space-y-3"><p className="text-xs text-slate-500">Scan this code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code.</p>{/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Authenticator QR code" width={180} height={180} className="rounded-lg border border-slate-200" /><form action={confirmMfaAction} className="flex gap-2"><input name="code" inputMode="numeric" maxLength={6} required placeholder="000000" className="input max-w-32 tracking-widest" /><SubmitButton className="btn-primary">Confirm</SubmitButton></form><form action={beginMfaAction}><SubmitButton className="btn-ghost btn-sm">Generate a new secret</SubmitButton></form></div>
          ) : (
            <form action={beginMfaAction}><p className="mb-3 text-xs text-slate-500">Protect your account with a time-based authenticator code at sign-in.</p><SubmitButton className="btn-secondary">Set up MFA</SubmitButton></form>
          )}
        </Panel>
        <Panel title="Active sessions" description="Revoke any device you do not recognise.">
          <ul className="divide-y divide-slate-100">{sessions.map((session) => <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-700">{session.user_agent ?? "Unknown device"}</p><p className="text-[10px] text-slate-400">{session.ip ?? "—"} · last seen {formatDateTime(session.last_seen_at)}</p></div><form action={revokeSessionAction}><input type="hidden" name="sessionId" value={session.id} /><SubmitButton className="btn-ghost btn-sm">Revoke</SubmitButton></form></li>)}{!sessions.length ? <li className="text-xs text-slate-500">No active sessions.</li> : null}</ul>
        </Panel>
      </div>
      {manage ? (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Panel title="Organisation profile" description="Used on reports and throughout the platform.">
              <form action={updateProfileSettingsAction} className="grid gap-2"><input name="orgName" defaultValue={settings.org.name} className="input" /><input name="department" defaultValue={settings.org.department} className="input" /><input name="address" defaultValue={settings.org.address} className="input" /><div className="grid grid-cols-2 gap-2"><input name="fiscalYear" type="number" defaultValue={settings.org.fiscalYear} className="input" /><div className="grid grid-cols-3 gap-1"><input name="critical" type="number" defaultValue={settings.risk.critical} className="input" title="Critical risk threshold" /><input name="high" type="number" defaultValue={settings.risk.high} className="input" title="High risk threshold" /><input name="medium" type="number" defaultValue={settings.risk.medium} className="input" title="Medium risk threshold" /></div></div><div className="grid grid-cols-3 gap-1"><input name="compliant" type="number" defaultValue={settings.scoring.compliant} className="input" title="Compliant score" /><input name="partial" type="number" defaultValue={settings.scoring.partial} className="input" title="Partially compliant score" /><input name="noncompliant" type="number" defaultValue={settings.scoring.noncompliant} className="input" title="Non-compliant score" /></div><p className="text-[10px] text-slate-400">Columns: risk thresholds (critical/high/medium), then scoring percentages (compliant/partial/non-compliant).</p><SubmitButton className="btn-primary">Save settings</SubmitButton></form>
            </Panel>
            <div className="space-y-4">
              <Panel title="Email notification outbox" description="SMTP is optional. Without configuration, emails remain in the outbox.">
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">{["pending","sent","skipped","failed"].slice(0,3).map((status) => <div key={status} className="rounded-lg bg-slate-50 p-2"><p className="text-base font-semibold">{outbox.find((r) => r.status === status)?.c ?? 0}</p><p className="text-[9px] uppercase text-slate-400">{status}</p></div>)}</div>
                <form action={processEmailsAction}><SubmitButton className="btn-secondary"><RefreshCw className="size-4" /> Process outbox</SubmitButton></form>
                <p className="mt-2 text-[10px] text-slate-400">Configure SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in .env.local to deliver email.</p>
              </Panel>
              <Panel title="Demo data" description="Reset all demonstration records. This signs you out and restores seeded data.">
                <form action={resetDemoAction} className="space-y-2"><input name="confirm" required placeholder="Type RESET to confirm" className="input" /><SubmitButton className="btn-danger" confirm="Reset all demo data? This cannot be undone.">Reset demo data</SubmitButton></form>
              </Panel>
            </div>
          </div>
          <Panel className="mt-4" title="Checklist templates" description="Manage the audit checklist engine from the dedicated builder."><Link href="/checklists" className="btn-secondary">Open checklist builder</Link></Panel>
        </>
      ) : null}
      <p className="mt-4 text-[10px] text-slate-400">All important changes are written to the append-only activity log.</p>
    </div>
  );
}
