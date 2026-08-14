"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  Search,
  LayoutDashboard,
  ClipboardCheck,
  Wrench,
  Hammer,
  AlertTriangle,
  ListChecks,
  History,
  RotateCcwClock,
  BarChart3,
  Building2,
  FileStack,
  Users,
  ShieldCheck,
  UsersRound,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  CheckCircle2,
  HardHat,
  Fingerprint,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth.actions";
import type { NavGroup, NavIconKey } from "@/components/layout/nav-items";
import { ROLE_LABELS, type RoleKeyValue } from "@/domain/shared/permissions";
import { GlobalSearch } from "@/components/domain/global-search";
import { RicoProvider } from "@/components/rico/rico-context";
import { RicoFloatingWidget } from "@/components/rico/rico-floating-widget";

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  checklist: ClipboardCheck,
  equipment: Wrench,
  maintenance: Hammer,
  alert: AlertTriangle,
  actionPlan: ListChecks,
  history: History,
  historyAll: RotateCcwClock,
  indicators: BarChart3,
  building: Building2,
  checklistTemplate: FileStack,
  users: Users,
  audit: ShieldCheck,
  collaborators: UsersRound,
  activities: FolderKanban,
  qualifications: GraduationCap,
  accidents: HeartPulse,
  schedules: CalendarDays,
  productivity: TrendingUp,
  checklistCompliance: ClipboardList,
  myPresence: CheckCircle2,
  epi: HardHat,
  jobFunctions: Fingerprint,
  rico: Sparkles,
};

export function AppShell({
  navGroups,
  user,
  children,
}: {
  navGroups: NavGroup[];
  user: { name: string; email: string; roleKey: string };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = React.useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const roleLabel = ROLE_LABELS[user.roleKey as RoleKeyValue] ?? user.roleKey;

  return (
    <RicoProvider userFirstName={user.name.split(" ")[0]}>
    <div className="flex min-h-screen w-full bg-background">
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed z-50 inset-y-0 left-0 w-64 flex-col bg-brand transition-transform lg:static lg:flex lg:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <Link href="/inicio" className="flex items-center">
            <Image src="/log20-wordmark.png" alt="Log 20 Logística" width={140} height={56} priority />
          </Link>
          <button
            className="lg:hidden text-white/70 hover:text-white"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 flex flex-col gap-5">
          {navGroups.map((group, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              {group.title && (
                <div className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-brand-accent"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-3 h-14 border-b border-border bg-surface px-4">
          <button
            className="lg:hidden text-foreground-subtle"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-surface-muted focus:outline-none">
                <Avatar name={user.name} size="sm" />
                <span className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium text-foreground">{user.name}</span>
                  <span className="text-[11px] text-foreground-subtle">{roleLabel}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger"
                  onSelect={() => {
                    void logoutAction();
                  }}
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <RicoFloatingWidget />
    </div>
    </RicoProvider>
  );
}

export function TopSearchIcon() {
  return <Search className="size-4 text-foreground-subtle" />;
}
