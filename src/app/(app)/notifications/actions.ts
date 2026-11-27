"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nowIso, run } from "@/db";
import { requirePermission } from "@/lib/auth/session";

export async function markNotificationReadAction(formData: FormData) {
  const user = await requirePermission("notifications.view");
  const id = String(formData.get("notificationId") ?? "");
  await run("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?", [nowIso(), id, user.id]);
  const link = String(formData.get("link") ?? "/notifications");
  if (link.startsWith("/") && !link.startsWith("//")) redirect(link);
  revalidatePath("/notifications");
  redirect("/notifications");
}

export async function markAllReadAction() {
  const user = await requirePermission("notifications.view");
  await run("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL", [nowIso(), user.id]);
  revalidatePath("/notifications");
  redirect("/notifications");
}
