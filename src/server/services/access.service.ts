import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";

const dayKey = (date: Date) => formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");

/** Último dia (por usuário) já marcado nesta instância — evita bater no banco a cada página. */
const markedToday = new Map<string, string>();

/**
 * Marca "essa pessoa usou o sistema hoje" (uma linha por usuário por dia na auditoria, ação
 * `ACCESS`). O login sozinho subconta o uso: a sessão dura 7 dias, então quem abre o app todo
 * dia só aparece como login uma vez por semana. Best-effort — nunca pode atrapalhar a página.
 */
export async function recordDailyAccess(userId: string): Promise<void> {
  try {
    const today = dayKey(new Date());
    if (markedToday.get(userId) === today) return;

    const startOfToday = new Date(`${today}T00:00:00-03:00`);
    const existing = await db.auditLog.findFirst({
      where: { userId, action: { in: ["ACCESS", "LOGIN"] }, occurredAt: { gte: startOfToday } },
      select: { id: true },
    });
    if (!existing) {
      await db.auditLog.create({ data: { userId, action: "ACCESS", entityType: "User", entityId: userId } });
    }
    markedToday.set(userId, today);
  } catch (error) {
    console.error("[access] falha ao registrar acesso diário:", error);
  }
}

export type AccessDay = { date: string; users: number; logins: number };
export type AccessMonth = { month: string; users: number; logins: number; activeDays: number };
export type AccessUserRow = { id: string; name: string; email: string; role: string; lastAccess: Date | null };

export type AccessOverview = {
  activeUsers: number;
  today: number;
  last7Days: number;
  last30Days: number;
  neverAccessed: AccessUserRow[];
  inactive: AccessUserRow[];
  days: AccessDay[];
  months: AccessMonth[];
  trackingSince: string | null;
};

const INACTIVE_AFTER_DAYS = 14;

/** Indicador de acessos: quem entra no sistema, por dia e por mês, e quem não entra. Soma login
 * (histórico desde o início) com a marca diária de uso (só a partir de quando foi ligada). */
export async function getAccessOverview(user: CurrentUser): Promise<AccessOverview> {
  requirePermission(user, PERMISSIONS.USER_MANAGE);

  const [users, events] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, lastLoginAt: true, role: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.auditLog.findMany({
      where: { action: { in: ["LOGIN", "ACCESS"] }, entityType: "User", userId: { not: null } },
      select: { userId: true, action: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const activeIds = new Set(users.map((u) => u.id));
  const usersByDay = new Map<string, Set<string>>();
  const loginsByDay = new Map<string, number>();
  const lastAccessByUser = new Map<string, Date>();
  let trackingSince: string | null = null;

  for (const e of events) {
    const uid = e.userId!;
    const key = dayKey(e.occurredAt);
    if (!trackingSince) trackingSince = key;
    if (!usersByDay.has(key)) usersByDay.set(key, new Set());
    usersByDay.get(key)!.add(uid);
    if (e.action === "LOGIN") loginsByDay.set(key, (loginsByDay.get(key) ?? 0) + 1);
    const prev = lastAccessByUser.get(uid);
    if (!prev || e.occurredAt > prev) lastAccessByUser.set(uid, e.occurredAt);
  }

  const now = new Date();
  const todayKey = dayKey(now);
  const keyDaysAgo = (n: number) => dayKey(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));

  const uniqueSince = (fromKey: string) => {
    const set = new Set<string>();
    for (const [key, ids] of usersByDay) if (key >= fromKey) for (const id of ids) if (activeIds.has(id)) set.add(id);
    return set.size;
  };

  const days: AccessDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = keyDaysAgo(i);
    days.push({ date: key, users: usersByDay.get(key)?.size ?? 0, logins: loginsByDay.get(key) ?? 0 });
  }

  const monthUsers = new Map<string, Set<string>>();
  const monthLogins = new Map<string, number>();
  const monthDays = new Map<string, number>();
  for (const [key, ids] of usersByDay) {
    const m = key.slice(0, 7);
    if (!monthUsers.has(m)) monthUsers.set(m, new Set());
    for (const id of ids) monthUsers.get(m)!.add(id);
    monthLogins.set(m, (monthLogins.get(m) ?? 0) + (loginsByDay.get(key) ?? 0));
    monthDays.set(m, (monthDays.get(m) ?? 0) + 1);
  }
  const months: AccessMonth[] = Array.from(monthUsers.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((m) => ({ month: m, users: monthUsers.get(m)!.size, logins: monthLogins.get(m) ?? 0, activeDays: monthDays.get(m) ?? 0 }));

  const rows: AccessUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role.name,
    lastAccess: lastAccessByUser.get(u.id) ?? u.lastLoginAt ?? null,
  }));

  const inactiveLimit = now.getTime() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;

  return {
    activeUsers: users.length,
    today: usersByDay.get(todayKey) ? [...usersByDay.get(todayKey)!].filter((id) => activeIds.has(id)).length : 0,
    last7Days: uniqueSince(keyDaysAgo(6)),
    last30Days: uniqueSince(keyDaysAgo(29)),
    neverAccessed: rows.filter((r) => !r.lastAccess),
    inactive: rows
      .filter((r) => r.lastAccess && r.lastAccess.getTime() < inactiveLimit)
      .sort((a, b) => a.lastAccess!.getTime() - b.lastAccess!.getTime()),
    days,
    months,
    trackingSince,
  };
}
