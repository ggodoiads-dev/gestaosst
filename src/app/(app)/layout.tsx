import { requireUser } from "@/server/auth/current-user";
import { getNavGroups } from "@/components/layout/nav-items";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navGroups = getNavGroups(user);

  return (
    <AppShell
      navGroups={navGroups}
      user={{ name: user.name, email: user.email, roleKey: user.roleKey }}
    >
      {children}
    </AppShell>
  );
}
