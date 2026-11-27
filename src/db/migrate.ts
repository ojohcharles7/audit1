import { closeDb, createDb } from "./index";
import path from "node:path";

const configured = process.env.DATABASE_PATH || ".data/audit.db";
const file = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
const db = createDb(file);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all()
  .map((row) => (row as { name: string }).name);
console.log(`Database ready at ${file}`);
console.log(`Tables: ${tables.join(", ")}`);
db.close();
closeDb();
