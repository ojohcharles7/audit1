import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

export type Db = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Promise<Record<string, unknown>[]>;
    get: (...params: unknown[]) => Promise<Record<string, unknown> | undefined>;
    run: (...params: unknown[]) => Promise<{ changes: number }>;
  };
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; changes: number }>;
};

const globalForDb = globalThis as unknown as { __crunchiesAuditPool?: Pool };
const txStore = new AsyncLocalStorage<PoolClient>();

function connectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the Supabase Postgres connection string to your environment.",
    );
  }
  return url;
}

function sslConfig(url: string) {
  if (/sslmode=disable/.test(url) || /localhost|127\.0\.0\.1/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

function pool() {
  if (!globalForDb.__crunchiesAuditPool) {
    const url = connectionString();
    const created = new Pool({
      connectionString: url,
      ssl: sslConfig(url),
      max: Number(process.env.PG_POOL_MAX || 1),
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
    });
    created.on("error", (error) => {
      console.error("Postgres pool error", error.message);
    });
    globalForDb.__crunchiesAuditPool = created;
  }
  return globalForDb.__crunchiesAuditPool;
}

function normalizeParams(params: unknown[]) {
  return params.map((value) => (value === undefined ? null : value));
}

function convertPlaceholders(sql: string) {
  let output = "";
  let index = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]!;
    if (quote) {
      output += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      continue;
    }
    if (char === "?") {
      output += `$${++index}`;
      continue;
    }
    output += char;
  }
  return output;
}

function makeDb(client: Pool | PoolClient): Db {
  return {
    prepare(sql: string) {
      const text = convertPlaceholders(sql);
      return {
        all: async (...params: unknown[]) => {
          const result = await client.query<QueryResultRow>(text, normalizeParams(params));
          return result.rows;
        },
        get: async (...params: unknown[]) => {
          const result = await client.query<QueryResultRow>(text, normalizeParams(params));
          return result.rows[0];
        },
        run: async (...params: unknown[]) => {
          const result = await client.query(text, normalizeParams(params));
          return { changes: result.rowCount ?? 0 };
        },
      };
    },
    async query(sql: string, params: unknown[] = []) {
      if (params.length) {
        const result = await client.query<QueryResultRow>(convertPlaceholders(sql), normalizeParams(params));
        return { rows: result.rows, changes: result.rowCount ?? 0 };
      }
      const result = (await client.query(sql)) as unknown as
        | QueryResultRow[]
        | { rows: QueryResultRow[]; rowCount: number | null };
      if (Array.isArray(result)) {
        return {
          rows: result.flatMap((item) => (item as unknown as { rows?: QueryResultRow[] }).rows ?? []),
          changes: result.reduce(
            (total, item) => total + ((item as unknown as { rowCount?: number }).rowCount ?? 0),
            0,
          ),
        };
      }
      return { rows: result.rows, changes: result.rowCount ?? 0 };
    },
  };
}

async function query(sql: string, params: unknown[] = []) {
  const client = txStore.getStore() ?? pool();
  return client.query<QueryResultRow>(convertPlaceholders(sql), normalizeParams(params));
}

export function getDb(): Db {
  return makeDb(pool());
}

export async function closeDb() {
  if (globalForDb.__crunchiesAuditPool) {
    await globalForDb.__crunchiesAuditPool.end();
    globalForDb.__crunchiesAuditPool = undefined;
  }
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await query(sql, params);
  return result.rows as T[];
}

export async function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const result = await query(sql, params);
  return result.rows[0] as T | undefined;
}

export async function run(sql: string, params: unknown[] = []) {
  const result = await query(sql, params);
  return { changes: result.rowCount ?? 0 };
}

/** Execute a multi-statement SQL script without parameters. */
export async function exec(sql: string) {
  const client = txStore.getStore() ?? pool();
  await client.query(sql);
}

export async function transaction<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await txStore.run(client, async () => fn(makeDb(client)));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}

export async function nextRef(name: string, prefix: string, width = 4) {
  const row = await get<{ value: number }>(
    `INSERT INTO counters (name, value) VALUES (?, 1)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [name],
  );
  return `${prefix}-${String(row?.value ?? 1).padStart(width, "0")}`;
}

/** Year-scoped reference such as AUD-2026-0001. */
export async function nextYearRef(name: string, prefix: string, width = 4) {
  const year = new Date().getFullYear();
  const key = `${name}:${year}`;
  const row = await get<{ value: number }>(
    `INSERT INTO counters (name, value) VALUES (?, 1)
     ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [key],
  );
  return `${prefix}-${year}-${String(row?.value ?? 1).padStart(width, "0")}`;
}
