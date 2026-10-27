import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { recordDailyAccess } from "@/server/services/access.service";
import { getNavGroups } from "@/components/layout/nav-items";
import { AppShell } from "@/components/layout/app-shell";
import { getAlertsSummary } from "@/server/services/alerts.service";
import { getUserNavWhitelist } from "@/server/services/nav-access.service";
import { filterNavGroups, isPathAllowed } from "@/domain/shared/nav-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  after(() => recordDailyAccess(user.id));
  const allNavGroups = getNavGroups(user);
  let navGroups = allNavGroups;
  let alerts = await getAlertsSummary(user);
  let showRico = true;

  // Acesso restrito por abas (Auditor): só o que o administrador marcou aparece e abre; alertas e Rico ficam de fora a menos que liberados.
  const whitelist = await getUserNavWhitelist(user);
  if (whitelist) {
    const allowed = new Set(whitelist);
    const pathname = (await headers()).get("x-pathname");
    if (pathname && !isPathAllowed(pathname, allowed, allNavGroups.flatMap((g) => g.items.map((i) => i.href)))) redirect("/inicio");
    navGroups = filterNavGroups(allNavGroups, allowed);
    showRico = allowed.has("/rico");
    alerts = { items: [], count: 0 };
  }

  return (
    <AppShell
      navGroups={navGroups}
      user={{ name: user.name, email: user.email, roleKey: user.roleKey }}
      alerts={alerts}
      showRico={showRico}
    >
      {children}
    </AppShell>
  );
}
