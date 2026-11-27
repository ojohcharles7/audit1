import { get } from "@/db";
import { NAV, ROLE_LABELS, permissionsFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const permissions = new Set(permissionsFor(user.role));
  const groups = NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => permissions.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  const unread = get<{ count: number }>(
    "SELECT count(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [user.id],
  );

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        initials: user.initials,
        title: user.title,
        roleLabel: ROLE_LABELS[user.role],
      }}
      groups={groups}
      notificationCount={unread?.count ?? 0}
    >
      {children}
    </AppShell>
  );
}
