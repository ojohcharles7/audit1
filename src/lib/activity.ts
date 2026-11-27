import crypto from "node:crypto";
import { all, newId, nowIso, transaction } from "@/db";

export type ActivityInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

function hashEntry(prevHash: string | null, payload: Record<string, unknown>) {
  return crypto
    .createHash("sha256")
    .update((prevHash ?? "genesis") + JSON.stringify(payload))
    .digest("hex");
}

export function logActivity(input: ActivityInput) {
  transaction((db) => {
    const prev = db
      .prepare("SELECT hash FROM activity_logs ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .get() as { hash: string } | undefined;
    const createdAt = nowIso();
    const payload = {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt,
    };
    const hash = hashEntry(prev?.hash ?? null, payload);
    db.prepare(
      "INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, summary, metadata_json, ip, user_agent, prev_hash, hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      newId(),
      payload.actorId,
      payload.action,
      payload.entityType,
      payload.entityId,
      payload.summary,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
      payload.ip,
      payload.userAgent,
      prev?.hash ?? null,
      hash,
      createdAt,
    );
  });
}

export function verifyActivityChain() {
  const rows = all<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: string;
    metadata_json: string | null;
    ip: string | null;
    user_agent: string | null;
    prev_hash: string | null;
    hash: string;
    created_at: string;
  }>("SELECT * FROM activity_logs ORDER BY created_at ASC, rowid ASC");
  let previous: string | null = null;
  for (const row of rows) {
    const payload = {
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      ip: row.ip,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    };
    const expected = hashEntry(previous, payload);
    if (row.prev_hash !== previous || row.hash !== expected) {
      return { valid: false, brokenAt: row.id, count: rows.length };
    }
    previous = row.hash;
  }
  return { valid: true, brokenAt: null, count: rows.length };
}

export function appendFraudUpdate(input: {
  caseId: string;
  kind: string;
  content: string;
  authorId: string;
  occurredAt: string;
}) {
  return transaction((db) => {
    const prev = db
      .prepare("SELECT hash FROM fraud_updates WHERE case_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .get(input.caseId) as { hash: string } | undefined;
    const createdAt = nowIso();
    const payload = { ...input, createdAt };
    const hash = hashEntry(prev?.hash ?? null, payload);
    db.prepare(
      "INSERT INTO fraud_updates (id, case_id, kind, content, author_id, occurred_at, prev_hash, hash, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      newId(),
      input.caseId,
      input.kind,
      input.content,
      input.authorId,
      input.occurredAt,
      prev?.hash ?? null,
      hash,
      createdAt,
    );
    return hash;
  });
}

export function verifyFraudChain(caseId: string) {
  const rows = all<{
    id: string;
    kind: string;
    content: string;
    author_id: string;
    occurred_at: string;
    prev_hash: string | null;
    hash: string;
    created_at: string;
  }>("SELECT * FROM fraud_updates WHERE case_id = ? ORDER BY created_at ASC, rowid ASC", [caseId]);
  let previous: string | null = null;
  for (const row of rows) {
    const payload = {
      caseId,
      kind: row.kind,
      content: row.content,
      authorId: row.author_id,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
    };
    const expected = hashEntry(previous, payload);
    if (row.prev_hash !== previous || row.hash !== expected) return { valid: false, count: rows.length };
    previous = row.hash;
  }
  return { valid: true, count: rows.length };
}
