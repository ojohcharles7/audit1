import fs from "node:fs";
import path from "node:path";
import { all, closeDb, exec, transaction } from "./index";

const envFile = [".env.local", ".env"].find((file) => fs.existsSync(file));
if (envFile) process.loadEnvFile(envFile);

async function main() {
  await exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const applied = new Set(
    (await all<{ name: string }>("SELECT name FROM _migrations")).map((row) => row.name),
  );

  const dir = path.join(process.cwd(), "src", "db", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await transaction(async (db) => {
      await db.query(sql);
      await db
        .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
        .run(file, new Date().toISOString());
    });
    console.log(`applied ${file}`);
  }

  const tables = await all<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log(`Database ready (${tables.length} tables)`);
  console.log(tables.map((row) => row.table_name).join(", "));

  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  try { await closeDb(); } catch {}
  process.exit(1);
});
