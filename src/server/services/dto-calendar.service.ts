import "server-only";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { assignLeaders, planDtoCalendar, type PlannerLeader } from "@/domain/dto/planner";

/**
 * Calendário semanal de DTO: de segunda a sexta, quem deve receber DTO em cada dia. Parte de hoje e distribui os
 * colaboradores ativos (exceto ADM/liderança) respeitando: a escala de trabalho da pessoa naquele dia, a carência de 60
 * dias desde o último DTO (ou justificativa) e a meta de DTOs por dia. Prioridade: novos (< 60 dias de casa), nunca
 * avaliados, e quem está há mais tempo sem DTO. Os dias que já passaram mostram os DTOs feitos de verdade.
 */

export const DTO_CALENDAR_MAX_WEEKS_AHEAD = 26;

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Segunda-feira da semana de `dayKey`. */
export function mondayOf(dayKey: string): string {
  const date = dateFromKey(dayKey);
  const offset = (date.getDay() + 6) % 7; // segunda = 0
  return keyOf(addDays(date, -offset));
}

export type DtoCalendarPerson = {
  collaboratorId: string;
  name: string;
  areaName: string | null;
  functionName: string | null;
  kind: "novo" | "nunca" | "tempo";
  tenureDays: number | null;
  daysSince: number | null;
  /** Liderança que deve fazer o DTO com essa pessoa (null = nenhuma liderança definida pra ela). */
  leaderName: string | null;
};

export type DtoCalendarDone = {
  id: string;
  collaboratorName: string;
  activity: string;
  scorePercent: number | null;
  evaluatorName: string | null;
};

export type DtoCalendarDay = {
  dayKey: string;
  weekday: string;
  isToday: boolean;
  isPast: boolean;
  planned: DtoCalendarPerson[];
  done: DtoCalendarDone[];
};

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

export async function getDtoCalendar(user: CurrentUser, params: { weekKey?: string; perDay?: number }) {
  if (!hasPermission(user, PERMISSIONS.DTO_MANAGE) && !hasPermission(user, PERMISSIONS.DTO_VIEW)) throw new ForbiddenError();

  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const currentMonday = mondayOf(todayKey);
  const perDay = Math.min(6, Math.max(1, Math.round(params.perDay ?? 2)));

  let weekStart = mondayOf(params.weekKey && /^\d{4}-\d{2}-\d{2}$/.test(params.weekKey) ? params.weekKey : todayKey);
  const maxWeek = keyOf(addDays(dateFromKey(currentMonday), DTO_CALENDAR_MAX_WEEKS_AHEAD * 7));
  if (weekStart > maxWeek) weekStart = maxWeek;
  const weekDays = [0, 1, 2, 3, 4].map((i) => keyOf(addDays(dateFromKey(weekStart), i)));
  const weekEnd = weekDays[4];

  const [collaborators, evaluations, justifications, notes, leaderUsers] = await Promise.all([
    db.collaborator.findMany({
      where: { active: true, OR: [{ functionId: null }, { function: { dtoExempt: false } }] },
      select: {
        id: true,
        name: true,
        areaId: true,
        turnoId: true,
        admissionDate: true,
        scheduleStartDate: true,
        area: { select: { name: true } },
        function: { select: { name: true } },
        turno: { select: { startDate: true, scheduleType: { select: { workDays: true, restDays: true } } } },
      },
    }),
    db.dtoEvaluation.findMany({
      orderBy: { date: "desc" },
      select: { id: true, collaboratorId: true, date: true, activity: true, scorePercent: true, evaluatorName: true, evaluatedName: true },
    }),
    db.dtoJustification.findMany({ select: { collaboratorId: true, date: true } }).catch(() => [] as { collaboratorId: string; date: Date }[]),
    db.scheduleDayNote.findMany({
      where: { date: { gte: dateFromKey(todayKey < weekStart ? todayKey : weekStart), lte: addDays(dateFromKey(weekEnd), 1) } },
      select: { collaboratorId: true, date: true, overrideStatus: true },
    }),
    // Lideranças = quem "faz chamada" (escopo por área/turno/pessoa em Usuários e Permissões).
    db.user.findMany({
      where: { active: true, canRollCall: true },
      select: {
        id: true,
        name: true,
        userRollCallAreas: { select: { areaId: true } },
        userRollCallTurnos: { select: { turnoId: true } },
        userRollCallCollaborators: { select: { collaboratorId: true } },
        collaboratorProfile: {
          select: { id: true, scheduleStartDate: true, turno: { select: { startDate: true, scheduleType: { select: { workDays: true, restDays: true } } } } },
        },
      },
    }),
  ]);

  const overrideByKey = new Map(notes.map((n) => [`${n.collaboratorId}|${keyOf(n.date)}`, n.overrideStatus]));

  const lastEffective = new Map<string, Date>();
  const bump = (collaboratorId: string, date: Date) => {
    const current = lastEffective.get(collaboratorId);
    if (!current || date > current) lastEffective.set(collaboratorId, date);
  };
  for (const e of evaluations) bump(e.collaboratorId, e.date);
  for (const j of justifications) bump(j.collaboratorId, j.date);

  const worksOn = (c: (typeof collaborators)[number], dayKey: string): boolean => {
    const override = overrideByKey.get(`${c.id}|${dayKey}`);
    if (override) return override === "TRABALHO";
    // Sem escala cadastrada: não dá pra saber a folga, então conta como dia útil.
    if (!c.turno) return true;
    return getCollaboratorDayStatus(dateFromKey(dayKey), c) === "TRABALHO";
  };

  // Simulação dia a dia a partir de hoje (dias úteis) até o fim da semana pedida — ver `planDtoCalendar`.
  const slots = planDtoCalendar({
    fromKey: todayKey,
    toKey: weekEnd,
    perDay,
    people: collaborators.map((c) => ({
      id: c.id,
      name: c.name,
      admissionDate: c.admissionDate,
      lastEffective: lastEffective.get(c.id) ?? null,
      works: (dayKey: string) => worksOn(c, dayKey),
    })),
  });
  const leaders: PlannerLeader[] = leaderUsers.map((u) => ({
    id: u.id,
    name: u.name,
    ownCollaboratorId: u.collaboratorProfile?.id ?? null,
    areaIds: new Set(u.userRollCallAreas.map((a) => a.areaId)),
    turnoIds: new Set(u.userRollCallTurnos.map((t) => t.turnoId)),
    collaboratorIds: new Set(u.userRollCallCollaborators.map((c) => c.collaboratorId)),
    // Sem escala cadastrada pra liderança: conta como dia útil.
    works: (dayKey: string) => (u.collaboratorProfile?.turno ? getCollaboratorDayStatus(dateFromKey(dayKey), u.collaboratorProfile) === "TRABALHO" : true),
  }));
  const leaderBySlot = assignLeaders(
    slots,
    new Map(collaborators.map((c) => [c.id, { id: c.id, areaId: c.areaId, turnoId: c.turnoId }])),
    leaders,
  );
  const byId = new Map(collaborators.map((c) => [c.id, c]));
  const planByDay = new Map<string, DtoCalendarPerson[]>();
  for (const [dayKey, list] of slots) {
    planByDay.set(
      dayKey,
      list.map((slot) => {
        const c = byId.get(slot.id)!;
        return {
          collaboratorId: c.id,
          name: c.name,
          areaName: c.area?.name ?? null,
          functionName: c.function?.name ?? null,
          kind: slot.kind,
          tenureDays: slot.tenureDays,
          daysSince: slot.daysSince,
          leaderName: leaderBySlot.get(`${dayKey}|${slot.id}`)?.name ?? null,
        };
      }),
    );
  }

  const doneByDay = new Map<string, DtoCalendarDone[]>();
  for (const e of evaluations) {
    const key = e.date.toISOString().slice(0, 10);
    if (key < weekStart || key > weekEnd) continue;
    doneByDay.set(key, [
      ...(doneByDay.get(key) ?? []),
      { id: e.id, collaboratorName: e.evaluatedName, activity: e.activity, scorePercent: e.scorePercent, evaluatorName: e.evaluatorName },
    ]);
  }

  const days: DtoCalendarDay[] = weekDays.map((dayKey, i) => ({
    dayKey,
    weekday: WEEKDAYS[i],
    isToday: dayKey === todayKey,
    isPast: dayKey < todayKey,
    planned: dayKey >= todayKey ? (planByDay.get(dayKey) ?? []) : [],
    done: doneByDay.get(dayKey) ?? [],
  }));

  return {
    weekStart,
    weekEnd,
    prevWeek: keyOf(addDays(dateFromKey(weekStart), -7)),
    nextWeek: weekStart >= maxWeek ? null : keyOf(addDays(dateFromKey(weekStart), 7)),
    isCurrentWeek: weekStart === currentMonday,
    currentMonday,
    perDay,
    eligibleTotal: collaborators.length,
    days,
  };
}
