import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { sanitizeProductionValues, type ProductionValues } from "@/domain/production/fields";
import { computeProductionStats, type ProductionStats, type ShiftReport } from "@/domain/production/stats";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";

/**
 * Produção do turno (carros carregados/trabalhados/amarrados, cargas e descargas), lançada UMA vez por dia e turno — não por pessoa.
 * Ver: indicadores consolidados, produtividade ou quem faz chamada. Lançar: gerenciar produtividade, ou o líder (que faz chamada) nos
 * turnos dele.
 */

export function canViewProduction(user: CurrentUser): boolean {
  return (
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED) ||
    hasPermission(user, PERMISSIONS.PRODUCTIVITY_VIEW) ||
    hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) ||
    hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM) ||
    user.canRollCall
  );
}

export function canLogProduction(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM) || user.canRollCall;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayToDate = (day: string) => new Date(`${day}T12:00:00.000Z`);
const dateToDay = (date: Date) => date.toISOString().slice(0, 10);

/** Turnos em que o usuário pode lançar: todos para quem gerencia produtividade; os da chamada dele para o líder (sem turno configurado, todos). */
export async function listLoggableTurnos(user: CurrentUser) {
  const turnos = await db.turno.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE)) return turnos;
  const own = user.rollCallTurnoIds;
  if (own && own.size > 0) return turnos.filter((t) => own.has(t.id));
  return turnos;
}

export type ShiftProductionInput = { day: string; turnoId: string; values: unknown; notes?: string | null };

export async function saveShiftProduction(user: CurrentUser, input: ShiftProductionInput) {
  if (!canLogProduction(user)) throw new ForbiddenError();
  if (!DAY_RE.test(input.day) || Number.isNaN(dayToDate(input.day).getTime())) throw new Error("Data inválida.");
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  if (input.day > today) throw new Error("A data não pode ser futura.");
  const allowed = await listLoggableTurnos(user);
  if (!allowed.some((t) => t.id === input.turnoId)) throw new ForbiddenError();

  const values = sanitizeProductionValues(input.values);
  if (Object.keys(values).length === 0) throw new Error("Preencha ao menos um número do relatório.");
  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 3000) : null;
  const date = dayToDate(input.day);

  const existing = await db.shiftProduction.findUnique({ where: { date_turnoId: { date, turnoId: input.turnoId } } });
  const saved = await db.shiftProduction.upsert({
    where: { date_turnoId: { date, turnoId: input.turnoId } },
    create: { date, turnoId: input.turnoId, values, notes, createdById: user.id },
    update: { values, notes },
  });
  await recordAudit({
    userId: user.id,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "ShiftProduction",
    entityId: saved.id,
    previousValue: existing ? { values: existing.values, notes: existing.notes } : undefined,
    newValue: { day: input.day, turnoId: input.turnoId, values, notes },
  });
  return saved;
}

export async function deleteShiftProduction(user: CurrentUser, id: string) {
  if (!canLogProduction(user)) throw new ForbiddenError();
  const existing = await db.shiftProduction.findUniqueOrThrow({ where: { id } });
  const allowed = await listLoggableTurnos(user);
  if (!allowed.some((t) => t.id === existing.turnoId)) throw new ForbiddenError();
  await db.shiftProduction.delete({ where: { id } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "ShiftProduction", entityId: id, previousValue: { values: existing.values, notes: existing.notes } });
}

async function loadReports(fromDay: string, toDayExclusive: string): Promise<ShiftReport[]> {
  const rows = await db.shiftProduction.findMany({
    where: { date: { gte: dayToDate(fromDay), lt: dayToDate(toDayExclusive) } },
    include: { turno: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { turno: { name: "asc" } }],
  });
  return rows.map((r) => ({ id: r.id, day: dateToDay(r.date), turno: r.turno.name, values: sanitizeProductionValues(r.values), notes: r.notes }));
}

const nextMonthKey = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export type ProductionView = {
  ready: boolean;
  months: string[];
  selected: string;
  year: number;
  month: ProductionStats;
  ytd: ProductionStats;
  reports: ShiftReport[];
};

const EMPTY_STATS = computeProductionStats([]);

export async function getProductionView(user: CurrentUser, periodParam?: string): Promise<ProductionView> {
  if (!canViewProduction(user)) throw new ForbiddenError();
  const currentMonth = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const selected = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : currentMonth;
  const year = Number(selected.slice(0, 4));
  try {
    const [reports, ytdReports, monthRows] = await Promise.all([
      loadReports(`${selected}-01`, `${nextMonthKey(selected)}-01`),
      loadReports(`${year}-01-01`, `${nextMonthKey(selected)}-01`),
      db.shiftProduction.findMany({ select: { date: true } }),
    ]);
    const months = [...new Set([currentMonth, ...monthRows.map((r) => dateToDay(r.date).slice(0, 7))])].sort();
    return { ready: true, months, selected, year, month: computeProductionStats(reports), ytd: computeProductionStats(ytdReports), reports };
  } catch (error) {
    console.error("[producao] tabela indisponível:", error);
    return { ready: false, months: [currentMonth], selected, year, month: EMPTY_STATS, ytd: EMPTY_STATS, reports: [] };
  }
}

/** Relatório já lançado para um dia + turno (para a tela de lançamento abrir preenchida). */
export async function getShiftProduction(user: CurrentUser, day: string, turnoId: string): Promise<{ values: ProductionValues; notes: string | null; id: string } | null> {
  if (!canViewProduction(user) || !DAY_RE.test(day)) return null;
  try {
    const row = await db.shiftProduction.findUnique({ where: { date_turnoId: { date: dayToDate(day), turnoId } } });
    return row ? { id: row.id, values: sanitizeProductionValues(row.values), notes: row.notes } : null;
  } catch {
    return null;
  }
}
