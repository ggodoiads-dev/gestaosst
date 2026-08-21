import { requireUser } from "@/server/auth/current-user";
import { getNavGroups } from "@/components/layout/nav-items";
import { AppShell } from "@/components/layout/app-shell";
import { getAlertsSummary } from "@/server/services/alerts.service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navGroups = getNavGroups(user);
  const alerts = await getAlertsSummary(user);

  return (
    <AppShell
      navGroups={navGroups}
      user={{ name: user.name, email: user.email, roleKey: user.roleKey }}
      alerts={alerts}
    >
      {children}
    </AppShell>
  );
}
