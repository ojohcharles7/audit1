import { all, get, newId, nowIso, run } from "@/db";
import type { RoleId } from "./auth/permissions";

export type NotificationInput = {
  type: string;
  severity?: "info" | "success" | "warning" | "critical";
  title: string;
  body: string;
  link?: string;
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function queueEmail(toEmail: string, subject: string, body: string) {
  await run(
    "INSERT INTO email_outbox (id, to_email, subject, body, status, created_at) VALUES (?,?,?,?,?,?)",
    [newId(), toEmail, subject, body, smtpConfigured() ? "pending" : "skipped", nowIso()],
  );
}

export async function notifyUsers(userIds: string[], input: NotificationInput) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  for (const userId of unique) {
    await run(
      "INSERT INTO notifications (id, user_id, type, severity, title, body, link, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [
        newId(),
        userId,
        input.type,
        input.severity ?? "info",
        input.title,
        input.body,
        input.link ?? null,
        nowIso(),
      ],
    );
    const user = await get<{ email: string }>("SELECT email FROM users WHERE id = ?", [userId]);
    if (user) await queueEmail(user.email, `[Crunchies Audit] ${input.title}`, input.body);
  }
}

export async function notifyRoles(roles: RoleId[], input: NotificationInput) {
  const placeholders = roles.map(() => "?").join(",");
  const users = await all<{ id: string }>(
    `SELECT id FROM users WHERE role IN (${placeholders}) AND deleted_at IS NULL AND status = 'active'`,
    roles,
  );
  await notifyUsers(
    users.map((u) => u.id),
    input,
  );
}

export async function notifyOutletManagers(outletId: string, input: NotificationInput) {
  const managers = await all<{ id: string }>(
    "SELECT id FROM users WHERE outlet_id = ? AND role = 'outlet_manager' AND deleted_at IS NULL",
    [outletId],
  );
  await notifyUsers(
    managers.map((m) => m.id),
    input,
  );
}

export async function notifyUserIdsForOutlet(outletId: string) {
  const row = await get<{ region_id: string }>("SELECT region_id FROM outlets WHERE id = ?", [outletId]);
  const users = await all<{ id: string }>(
    "SELECT id FROM users WHERE (outlet_id = ? OR (role = 'regional_manager' AND region_id = ?)) AND deleted_at IS NULL AND status = 'active'",
    [outletId, row?.region_id ?? ""],
  );
  return users.map((u) => u.id);
}

export async function escalateCriticalFinding(input: {
  findingId: string;
  ref: string;
  title: string;
  outletId: string;
  severity: string;
}) {
  const row = await get<{ name: string; region_id: string }>(
    "SELECT name, region_id FROM outlets WHERE id = ?",
    [input.outletId],
  );
  const head = await all<{ id: string }>(
    "SELECT id FROM users WHERE role = 'head_audit' AND deleted_at IS NULL",
  );
  const execs = await all<{ id: string }>(
    "SELECT id FROM users WHERE role = 'executive' AND deleted_at IS NULL",
  );
  const regional = await all<{ id: string }>(
    "SELECT id FROM users WHERE role = 'regional_manager' AND region_id = ? AND deleted_at IS NULL",
    [row?.region_id ?? ""],
  );
  const recipients = [...head, ...execs, ...regional].map((u) => u.id);
  await run(
    "INSERT INTO escalations (id, finding_id, level, reason, escalated_to, created_at) VALUES (?,?,?,?,?,?)",
    [
      newId(),
      input.findingId,
      "executive",
      `Critical finding ${input.ref} at ${row?.name ?? "outlet"}`,
      "Head of Internal Audit; Executive Management; Regional Manager",
      nowIso(),
    ],
  );
  await notifyUsers(recipients, {
    type: "escalation",
    severity: "critical",
    title: `Critical finding: ${input.ref}`,
    body: `${input.title} at ${row?.name ?? "outlet"} requires immediate attention.`,
    link: `/findings/${input.findingId}`,
  });
}

export async function processEmailOutbox(limit = 25) {
  const pending = await all<{ id: string; to_email: string; subject: string; body: string }>(
    "SELECT * FROM email_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
    [limit],
  );
  if (!smtpConfigured()) {
    await run("UPDATE email_outbox SET status = 'skipped', error = ? WHERE status = 'pending'", [
      "SMTP not configured",
    ]);
    return { sent: 0, skipped: pending.length };
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  let sent = 0;
  for (const email of pending) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || "audit@crunchiesfood.com",
        to: email.to_email,
        subject: email.subject,
        text: email.body,
      });
      await run("UPDATE email_outbox SET status = 'sent', sent_at = ? WHERE id = ?", [
        nowIso(),
        email.id,
      ]);
      sent++;
    } catch (error) {
      await run("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?", [
        String(error),
        email.id,
      ]);
    }
  }
  return { sent, skipped: 0 };
}
