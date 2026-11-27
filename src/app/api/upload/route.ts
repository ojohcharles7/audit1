import { NextResponse } from "next/server";
import { get, newId, nextYearRef, nowIso, run } from "@/db";
import { assertOrigin, getRequestMeta, getSessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { canAccessAudit, canAccessOutlet, canViewFraudCase, getScope } from "@/lib/scope";
import { saveUpload, validateUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await assertOrigin(request))) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = getScope(user);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file supplied" }, { status: 400 });
  const invalid = validateUpload(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const auditId = String(form.get("auditId") ?? "") || null;
  const findingId = String(form.get("findingId") ?? "") || null;
  const fraudCaseId = String(form.get("fraudCaseId") ?? "") || null;
  const outletId = String(form.get("outletId") ?? "") || null;
  const actionId = String(form.get("actionId") ?? "") || null;
  const category = String(form.get("category") ?? "general");
  const description = String(form.get("description") ?? "") || null;

  if (auditId && !canAccessAudit(scope, auditId)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (fraudCaseId && !canViewFraudCase(user, fraudCaseId)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (outletId && !canAccessOutlet(scope, outletId)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  if (findingId) {
    const finding = get<{ outlet_id: string }>("SELECT outlet_id FROM findings WHERE id=?", [findingId]);
    if (!finding || !canAccessOutlet(scope, finding.outlet_id)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (actionId) {
    const action = get<{ outlet_id: string }>(
      "SELECT f.outlet_id FROM corrective_actions ca JOIN findings f ON f.id=ca.finding_id WHERE ca.id=?",
      [actionId],
    );
    if (!action || !canAccessOutlet(scope, action.outlet_id)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!auditId && !findingId && !fraudCaseId && !outletId && !actionId) {
    return NextResponse.json({ error: "A document must be linked to an audit, finding, case, action or outlet" }, { status: 400 });
  }

  const saved = await saveUpload(file, user.id);
  const id = newId();
  const ref = nextYearRef("document", "DOC");
  const meta = await getRequestMeta();
  run(
    `INSERT INTO documents (id, ref, filename, original_name, mime_type, size_bytes, sha256, storage_path, uploaded_by, outlet_id, audit_id, finding_id, fraud_case_id, action_id, category, confidentiality, description, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      ref,
      saved.filename,
      saved.originalName,
      saved.mime,
      saved.size,
      saved.sha256,
      saved.filename,
      user.id,
      outletId,
      auditId,
      findingId,
      fraudCaseId,
      actionId,
      category,
      fraudCaseId ? "restricted" : "internal",
      description,
      nowIso(),
    ],
  );
  run(
    "INSERT INTO document_access_log (id, document_id, user_id, action, ip, created_at) VALUES (?,?,?,?,?,?)",
    [newId(), id, user.id, "upload", meta.ip, nowIso()],
  );
  logActivity({
    actorId: user.id,
    action: "document.uploaded",
    entityType: "document",
    entityId: id,
    summary: `Uploaded evidence ${ref}: ${saved.originalName}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ id, ref, name: saved.originalName, mime: saved.mime, size: saved.size });
}
