import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
]);

export function storageDir() {
  return path.join(process.cwd(), "storage", "evidence");
}

export function ensureStorage() {
  fs.mkdirSync(storageDir(), { recursive: true });
}

export function validateUpload(file: File) {
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_BYTES) return "Files must be 15MB or smaller.";
  if (!ALLOWED.has(file.type)) return "This file type is not permitted. Upload images, PDF, Office, CSV or text files.";
  return null;
}

export async function saveUpload(file: File, userId: string) {
  ensureStorage();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).slice(0, 10).replace(/[^.a-z0-9]/gi, "") || ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(storageDir(), filename), buffer);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 160);
  return { filename, sha256, size: buffer.length, originalName: safeName, mime: file.type, userId };
}

export function resolveStoredFile(stored: string) {
  const base = path.resolve(storageDir());
  const target = path.resolve(base, path.basename(stored));
  if (!target.startsWith(base)) return null;
  if (!fs.existsSync(target)) return null;
  return target;
}
