import fs from "node:fs";
import { closeDb, transaction } from "./index";
import { seedDatabase } from "./seed-data";

const envFile = [".env.local", ".env"].find((file) => fs.existsSync(file));
if (envFile) process.loadEnvFile(envFile);

async function main() {
  console.log("Seeding Supabase Postgres ...");
  const started = Date.now();
  const result = await transaction((db) => seedDatabase(db));
  console.log(`Seeded in ${Date.now() - started}ms`);
  console.log(result);
  console.log("Demo password: Audit@2026");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  try { await closeDb(); } catch {}
  process.exit(1);
});
