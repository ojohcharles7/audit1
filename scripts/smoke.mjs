import fs from "node:fs";
import Database from "better-sqlite3";
import { SignJWT } from "jose";
import crypto from "node:crypto";

const env = fs.readFileSync(".env.local", "utf8");
const secret = env.match(/SESSION_SECRET=(.+)/)?.[1]?.trim();
const port = process.env.PORT || 3100;
const base = `http://localhost:${port}`;
const db = new Database(".data/audit.db");

async function cookieFor(email) {
  const user = db.prepare("SELECT id, role, name FROM users WHERE email = ?").get(email);
  if (!user) throw new Error(`Missing user ${email}`);
  const sid = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(Date.now() + 12 * 3600 * 1000);
  db.prepare("INSERT INTO sessions (id, user_id, token_id, ip, user_agent, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(crypto.randomUUID(), user.id, sid, "127.0.0.1", "smoke-test", now.toISOString(), now.toISOString(), expires.toISOString());
  const token = await new SignJWT({ uid: user.id, sid, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secret));
  return `crunchies_audit_session=${token}`;
}

const head = await cookieFor("head.audit@crunchiesfood.com");
const outlet = await cookieFor("outlet@crunchiesfood.com");
const auditor = await cookieFor("auditor@crunchiesfood.com");

const pages = ["/dashboard","/planning","/audits","/checklists","/findings","/risks","/fraud","/controls","/actions","/reports","/outlets","/staff","/evidence","/notifications","/settings","/logs","/rankings"];
let failures = 0;
for (const page of pages) {
  const res = await fetch(base + page, { headers: { cookie: head }, redirect: "manual" });
  const ok = res.status === 200;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "FAIL"} ${res.status} ${page}`);
}
const outletFraud = await fetch(base + "/fraud", { headers: { cookie: outlet }, redirect: "manual" });
console.log(`${outletFraud.status === 307 || outletFraud.status === 200 ? "OK " : "FAIL"} ${outletFraud.status} outlet-manager /fraud (expected redirect)`);
if (outletFraud.status === 200) {
  const body = await outletFraud.text();
  if (body.includes("Case register")) { failures++; console.log("FAIL outlet manager saw fraud register"); }
}

const roleChecks = [
  ["outlet@crunchiesfood.com", ["/dashboard","/audits","/findings","/actions","/outlets","/reports","/notifications","/settings","/logs"]],
  ["regional@crunchiesfood.com", ["/dashboard","/audits","/findings","/actions","/outlets","/reports","/risks","/rankings"]],
  ["finance@crunchiesfood.com", ["/dashboard","/findings","/reports","/outlets","/actions"]],
  ["executive@crunchiesfood.com", ["/dashboard","/reports","/outlets","/rankings","/risks","/controls"]],
  ["auditor@crunchiesfood.com", ["/dashboard","/audits","/findings","/risks","/controls","/evidence"]],
];
for (const [email, paths] of roleChecks) {
  const cookie = await cookieFor(email);
  for (const page of paths) {
    const res = await fetch(base + page, { headers: { cookie }, redirect: "manual" });
    const ok = res.status === 200;
    if (!ok) failures++;
    console.log(`${ok ? "OK " : "FAIL"} ${res.status} ${email.split("@")[0]} ${page}`);
  }
}
const denied = await fetch(base + "/staff", { headers: { cookie: outlet }, redirect: "manual" });
console.log(`${denied.status === 307 ? "OK " : "FAIL"} ${denied.status} outlet manager /staff redirect`);
if (denied.status !== 307) failures++;

const audit = db.prepare("SELECT id FROM audits WHERE auditor_id=(SELECT id FROM users WHERE email='auditor@crunchiesfood.com') AND status IN ('in_progress','scheduled') LIMIT 1").get();
if (audit) {
  const res = await fetch(base + `/audits/${audit.id}/conduct`, { headers: { cookie: auditor } });
  console.log(`${res.status === 200 ? "OK " : "FAIL"} ${res.status} /audits/${audit.id}/conduct as auditor`);
  if (res.status !== 200) failures++;
  const question = db.prepare("SELECT q.id FROM checklist_questions q JOIN audits a ON a.template_id=q.template_id WHERE a.id=? LIMIT 1").get(audit.id);
  const saveRes = await fetch(base + "/api/checklist/save", { method: "POST", headers: { cookie: auditor, "content-type": "application/json", origin: base }, body: JSON.stringify({ auditId: audit.id, questionId: question.id, result: "compliant", comment: "Smoke test response" }) });
  console.log(`${saveRes.status === 200 ? "OK " : "FAIL"} ${saveRes.status} checklist autosave`);
  if (saveRes.status !== 200) failures++;
  const submitRes = await fetch(base + "/api/audits/submit", { method: "POST", headers: { cookie: auditor, "content-type": "application/json", origin: base }, body: JSON.stringify({ auditId: audit.id }) });
  console.log(`${submitRes.status === 400 ? "OK " : "FAIL"} ${submitRes.status} incomplete submission rejected`);
  if (submitRes.status !== 400) failures++;
}
const report = db.prepare("SELECT id FROM audit_reports LIMIT 1").get();
if (report) {
  for (const [kind, mime] of [["pdf", "application/pdf"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]]) {
    const res = await fetch(base + `/api/reports/${report.id}/${kind}`, { headers: { cookie: head } });
    const ct = res.headers.get("content-type") ?? "";
    const body = await res.arrayBuffer();
    const ok = res.status === 200 && ct.includes(mime) && body.byteLength > 0;
    if (!ok) failures++;
    console.log(`${ok ? "OK " : "FAIL"} ${res.status} report ${kind} ${ct}`);
  }
}
const doc = db.prepare("SELECT id FROM documents LIMIT 1").get();
if (doc) {
  const res = await fetch(base + `/api/files/${doc.id}`, { headers: { cookie: head } });
  const ok = res.status === 200;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "FAIL"} ${res.status} secure file download`);
}
const login = await fetch(base + "/login", { redirect: "manual" });
console.log(`${login.status === 200 ? "OK " : "FAIL"} ${login.status} /login`);
if (login.status !== 200) failures++;
console.log(failures === 0 ? "SMOKE PASS" : `SMOKE FAILURES: ${failures}`);
db.close();
process.exit(failures ? 1 : 0);
