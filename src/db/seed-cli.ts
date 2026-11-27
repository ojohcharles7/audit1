import path from "node:path";
import { createDb } from "./index";
import { seedDatabase } from "./seed-data";

const configured = process.env.DATABASE_PATH || ".data/audit.db";
const file = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
const db = createDb(file);

console.log(`Seeding ${file} ...`);
const started = Date.now();
const result = seedDatabase(db);
db.close();
console.log(`Seeded in ${Date.now() - started}ms`);
console.log(result);
console.log("Demo password: Audit@2026");
