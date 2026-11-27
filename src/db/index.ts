import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type Db = Database.Database;

const globalForDb = globalThis as unknown as { __crunchiesAuditDb?: Db };

function databasePath() {
  const configured = process.env.DATABASE_PATH || ".data/audit.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function migrationFiles() {
  const dir = path.join(process.cwd(), "src", "db", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function migrate(db: Db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((row) => (row as { name: string }).name),
  );
  for (const file of migrationFiles()) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(process.cwd(), "src", "db", "migrations", file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString(),
      );
    });
    tx();
  }
}

export function createDb(file = databasePath()): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function getDb(): Db {
  if (!globalForDb.__crunchiesAuditDb) {
    globalForDb.__crunchiesAuditDb = createDb();
  }
  return globalForDb.__crunchiesAuditDb;
}

export function closeDb() {
  globalForDb.__crunchiesAuditDb?.close();
  globalForDb.__crunchiesAuditDb = undefined;
}

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: (db: Db) => T): T {
  return getDb().transaction(fn)(getDb());
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}

export function nextRef(name: string, prefix: string, width = 4) {
  const db = getDb();
  const tx = db.transaction(() => {
    const row = db.prepare("SELECT value FROM counters WHERE name = ?").get(name) as
      | { value: number }
      | undefined;
    const next = (row?.value ?? 0) + 1;
    if (row) db.prepare("UPDATE counters SET value = ? WHERE name = ?").run(next, name);
    else db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run(name, next);
    return `${prefix}-${String(next).padStart(width, "0")}`;
  });
  return tx();
}

/** Year-scoped reference such as AUD-2026-0001. */
export function nextYearRef(name: string, prefix: string, width = 4) {
  const year = new Date().getFullYear();
  const db = getDb();
  const tx = db.transaction(() => {
    const key = `${name}:${year}`;
    const row = db.prepare("SELECT value FROM counters WHERE name = ?").get(key) as
      | { value: number }
      | undefined;
    const next = (row?.value ?? 0) + 1;
    if (row) db.prepare("UPDATE counters SET value = ? WHERE name = ?").run(next, key);
    else db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run(key, next);
    return `${prefix}-${year}-${String(next).padStart(width, "0")}`;
  });
  return tx();
}
