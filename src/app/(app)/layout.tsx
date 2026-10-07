import { after } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { recordDailyAccess } from "@/server/services/access.service";
import { getNavGroups } from "@/components/layout/nav-items";
import { AppShell } from "@/components/layout/app-shell";
import { getAlertsSummary } from "@/server/services/alerts.service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  after(() => recordDailyAccess(user.id));
  const navGroups = getNavGroups(user);
  const alerts = await getAlertsSummary(user);

  return (
    <AppShell
      navGroups={navGroups}
      user={{ name: user.name, email: user.email, roleKey: user.roleKey }}
      alerts={alerts}
      showRico={user.permissions.has(PERMISSIONS.CHECKLIST_EXECUTE)}
    >
      {children}
    </AppShell>
  );
}
