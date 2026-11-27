"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newId, nextYearRef, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { canAccessOutlet, getScope } from "@/lib/scope";
import { saveUpload, validateUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export async function uploadEvidenceAction(formData: FormData) {
  const user = await requirePermission("evidence.upload");
  const scope = getScope(user);
  const file = formData.get("file");
  if (!(file instanceof File)) redirect("/evidence?error=Choose+a+file+to+upload");
  const invalid = validateUpload(file);
  if (invalid) redirect(`/evidence?error=${encodeURIComponent(invalid)}`);
  const outletId = String(formData.get("outletId") ?? "") || null;
  if (outletId && !canAccessOutlet(scope, outletId)) redirect("/evidence?error=Access+denied");
  if (!outletId) redirect("/evidence?error=Select+an+outlet+for+the+evidence");
  const saved = await saveUpload(file, user.id);
  const id = newId();
  run(
    "INSERT INTO documents (id, ref, filename, original_name, mime_type, size_bytes, sha256, storage_path, uploaded_by, outlet_id, category, confidentiality, description, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, nextYearRef("document", "DOC"), saved.filename, saved.originalName, saved.mime, saved.size, saved.sha256, saved.filename, user.id, outletId, String(formData.get("category") ?? "general"), "internal", String(formData.get("description") ?? "") || null, nowIso()],
  );
  logActivity({ actorId: user.id, action: "document.uploaded", entityType: "document", entityId: id, summary: `Uploaded evidence ${saved.originalName}` });
  revalidatePath("/evidence");
  redirect("/evidence?uploaded=1");
}
