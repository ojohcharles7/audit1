import fs from "node:fs";
import { get, newId, nowIso, run } from "@/db";
import { getRequestMeta, getSessionUser } from "@/lib/auth/session";
import { canAccessAudit, canAccessOutlet, canViewFraudCase, getScope } from "@/lib/scope";
import { resolveStoredFile } from "@/lib/storage";
import type { DocumentRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const scope = await getScope(user);
  const { id } = await params;
  const document = await get<DocumentRow>("SELECT * FROM documents WHERE id=? AND deleted_at IS NULL", [id]);
  if (!document) return new Response("Not found", { status: 404 });

  let allowed = false;
  if (document.fraud_case_id) {
    allowed = await canViewFraudCase(user, document.fraud_case_id);
  } else if (document.audit_id) {
    allowed = await canAccessAudit(scope, document.audit_id);
  } else if (document.finding_id) {
    const finding = await get<{ outlet_id: string }>("SELECT outlet_id FROM findings WHERE id=?", [document.finding_id]);
    allowed = Boolean(finding && await canAccessOutlet(scope, finding.outlet_id));
  } else if (document.outlet_id) {
    allowed = await canAccessOutlet(scope, document.outlet_id);
  } else {
    allowed = user.role !== "outlet_manager";
  }
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const file = resolveStoredFile(document.storage_path);
  if (!file) return new Response("File missing", { status: 404 });
  const meta = await getRequestMeta();
  await run("INSERT INTO document_access_log (id, document_id, user_id, action, ip, created_at) VALUES (?,?,?,?,?,?)", [
    newId(),
    document.id,
    user.id,
    "view",
    meta.ip,
    nowIso(),
  ]);
  const buffer = fs.readFileSync(file);
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(buffer, {
    headers: {
      "Content-Type": document.mime_type,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.original_name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
