"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, newId, nextYearRef, nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { canAccessOutlet, getScope } from "@/lib/scope";
import { computeRisk } from "@/lib/risk";
import { DEFAULT_SETTINGS, getSetting } from "@/lib/settings";

export async function createRiskAction(formData: FormData) {
  const user = await requirePermission("risks.manage");
  const scope = getScope(user);
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const likelihood = Number(formData.get("likelihood") ?? 3);
  const impact = Number(formData.get("impact") ?? 3);
  const effectiveness = String(formData.get("effectiveness") ?? "satisfactory");
  const outletId = String(formData.get("outletId") ?? "") || null;
  if (!title || !category) redirect("/risks?error=Title+and+category+are+required");
  if (outletId && !canAccessOutlet(scope, outletId)) redirect("/risks?error=Access+denied");
  const settings = getSetting<typeof DEFAULT_SETTINGS.risk>("risk");
  const computed = computeRisk(likelihood, impact, effectiveness, settings);
  const id = newId();
  run(
    "INSERT INTO risks (id, ref, outlet_id, category, title, description, cause, likelihood, impact, inherent_score, existing_controls, control_effectiveness, residual_score, rating, owner_id, mitigation, review_date, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      id,
      nextYearRef("risk", "RSK"),
      outletId,
      category,
      title,
      String(formData.get("description") ?? ""),
      String(formData.get("cause") ?? "") || null,
      likelihood,
      impact,
      computed.inherent,
      String(formData.get("existingControls") ?? "") || null,
      effectiveness,
      computed.residual,
      computed.rating,
      String(formData.get("ownerId") ?? "") || null,
      String(formData.get("mitigation") ?? "") || null,
      String(formData.get("reviewDate") ?? "") || null,
      "open",
      user.id,
      nowIso(),
      nowIso(),
    ],
  );
  logActivity({ actorId: user.id, action: "risk.created", entityType: "risk", entityId: id, summary: `Created ${computed.rating} risk: ${title}` });
  revalidatePath("/risks");
  redirect(`/risks/${id}`);
}

export async function updateRiskAction(formData: FormData) {
  const user = await requirePermission("risks.manage");
  const id = String(formData.get("riskId") ?? "");
  const risk = get<{ ref: string }>("SELECT ref FROM risks WHERE id=?", [id]);
  if (!risk) redirect("/risks?error=Risk+not+found");
  const likelihood = Math.max(1, Math.min(5, Number(formData.get("likelihood") ?? 3)));
  const impact = Math.max(1, Math.min(5, Number(formData.get("impact") ?? 3)));
  const effectiveness = String(formData.get("effectiveness") ?? "satisfactory");
  const settings = getSetting<typeof DEFAULT_SETTINGS.risk>("risk");
  const computed = computeRisk(likelihood, impact, effectiveness, settings);
  run(
    "UPDATE risks SET likelihood=?, impact=?, inherent_score=?, control_effectiveness=?, residual_score=?, rating=?, existing_controls=?, mitigation=?, review_date=?, status=?, description=?, updated_at=? WHERE id=?",
    [
      likelihood,
      impact,
      computed.inherent,
      effectiveness,
      computed.residual,
      computed.rating,
      String(formData.get("existingControls") ?? "") || null,
      String(formData.get("mitigation") ?? "") || null,
      String(formData.get("reviewDate") ?? "") || null,
      String(formData.get("status") ?? "open"),
      String(formData.get("description") ?? ""),
      nowIso(),
      id,
    ],
  );
  logActivity({ actorId: user.id, action: "risk.updated", entityType: "risk", entityId: id, summary: `Updated risk ${risk.ref} to ${computed.rating}` });
  revalidatePath(`/risks/${id}`);
  revalidatePath("/risks");
  redirect(`/risks/${id}?updated=1`);
}
