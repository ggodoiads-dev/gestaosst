import "server-only";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { rollCallCollaboratorWhere, type RollCallCollaboratorWhere } from "@/server/services/attendance-rollcall.service";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS, type PermissionKey } from "@/domain/shared/permissions";

export type ProductivityEntryInput = {
  collaboratorId: string;
  date: Date;
  activityId: string;
  quantity?: number | null;
  notes?: string | null;
};

/** Colaborador vinculado ao usuário logado (via `Collaborator.userId`), se houver. Inclui
 * turno/tipo de escala pra também servir a tela de "Minha Escala", sem duplicar a query. */
export function getMyCollaboratorProfile(user: CurrentUser) {
  return db.collaborator.findUnique({
    where: { userId: user.id },
    include: { turno: { include: { scheduleType: true } } },
  });
}

/** Libera acesso a dados de produtividade de `collaboratorId` pra quem gerencia produtividade
 * de qualquer colaborador (`PRODUCTIVITY_MANAGE`), pra um líder lançando pela equipe
 * (`PRODUCTIVITY_MANAGE_TEAM`, escopado pelas MESMAS áreas/turnos configurados pra ele em
 * "Faz chamada?" — decisão do negócio: quem lança produtividade da equipe é sempre quem também
 * faz a chamada dela, um escopo só configurado em Acessos), ou pro próprio colaborador — quais
 * permissões contam como "acesso próprio" variam por caso de uso: ver (`PRODUCTIVITY_SELF_VIEW`
 * ou `PRODUCTIVITY_SELF_LOG`) é mais permissivo que lançar/apagar (só `PRODUCTIVITY_SELF_LOG`). */
async function assertProductivityAccess(
  user: CurrentUser,
  collaboratorId: string,
  selfPermissions: PermissionKey[],
) {
  if (user.permissions.has(PERMISSIONS.PRODUCTIVITY_MANAGE)) return;
  if (user.permissions.has(PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM)) {
    const scope = rollCallCollaboratorWhere(user);
    if (scope) {
      const target = await db.collaborator.findUnique({ where: { id: collaboratorId }, select: { areaId: true, turnoId: true } });
      const areaOk = Boolean(target?.areaId && scope.areaId.in.includes(target.areaId));
      const turnoOk = !scope.turnoId || Boolean(target?.turnoId && scope.turnoId.in.includes(target.turnoId));
      if (areaOk && turnoOk) return;
    }
  }
  if (selfPermissions.some((p) => user.permissions.has(p))) {
    const own = await getMyCollaboratorProfile(user);
    if (own?.id === collaboratorId) return;
  }
  throw new ForbiddenError();
}

const VIEW_SELF_PERMISSIONS = [PERMISSIONS.PRODUCTIVITY_SELF_LOG, PERMISSIONS.PRODUCTIVITY_SELF_VIEW];
const LOG_SELF_PERMISSIONS = [PERMISSIONS.PRODUCTIVITY_SELF_LOG];

/** Mesmo critério de `areaScope` em `indicators.service.ts`/`time-clock.service.ts`, mas
 * reaproveitando o escopo de chamada: quem tem `PRODUCTIVITY_MANAGE` vê todo mundo (sem filtro);
 * quem só tem `PRODUCTIVITY_MANAGE_TEAM` fica restrito às áreas/turnos configurados pra ele fazer
 * chamada — sem nada configurado, o filtro não bate com ninguém (lista vazia, não um erro, já
 * que essas funções alimentam telas de visão geral). */
function productivityCollaboratorScopeWhere(user: CurrentUser): RollCallCollaboratorWhere | undefined {
  if (user.permissions.has(PERMISSIONS.PRODUCTIVITY_MANAGE)) return undefined;
  return rollCallCollaboratorWhere(user) ?? { areaId: { in: [] } };
}

export async function createProductivityEntry(user: CurrentUser, data: ProductivityEntryInput) {
  await assertProductivityAccess(user, data.collaboratorId, LOG_SELF_PERMISSIONS);

  const entry = await db.$transaction(async (tx) => {
    const created = await tx.productivityEntry.create({ data: { ...data, createdById: user.id } });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "ProductivityEntry", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return entry;
}

export async function deleteProductivityEntry(user: CurrentUser, id: string) {
  const entry = await db.productivityEntry.findUniqueOrThrow({ where: { id }, select: { collaboratorId: true } });
  await assertProductivityAccess(user, entry.collaboratorId, LOG_SELF_PERMISSIONS);
  await db.productivityEntry.delete({ where: { id } });
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Monta a grade de dias (trabalho/folga + lançamentos) de um colaborador entre duas datas
 * (ambas inclusive), sem checar permissão — usado pelas funções públicas abaixo. */
async function buildCollaboratorDays(collaboratorId: string, from: Date, toInclusive: Date) {
  const rangeStart = startOfDay(from);
  const rangeEndExclusive = addDays(startOfDay(toInclusive), 1);

  const [collaborator, notes, entries] = await Promise.all([
    db.collaborator.findUniqueOrThrow({
      where: { id: collaboratorId },
      include: { turno: { include: { scheduleType: true } } },
    }),
    db.scheduleDayNote.findMany({
      where: { collaboratorId, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
    db.productivityEntry.findMany({
      where: { collaboratorId, date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { activity: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const notesByKey = new Map(notes.map((n) => [localDateKey(n.date), n]));
  const entriesByKey = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = localDateKey(entry.date);
    entriesByKey.set(key, [...(entriesByKey.get(key) ?? []), entry]);
  }

  const days = [];
  for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
    const key = localDateKey(date);
    const note = notesByKey.get(key) ?? null;
    const computed = getCollaboratorDayStatus(date, collaborator);
    days.push({
      date,
      status: note ? note.overrideStatus : computed,
      entries: entriesByKey.get(key) ?? [],
    });
  }

  return { collaborator, days };
}

/** Relatório de um colaborador num intervalo qualquer (dia/semana/mês, à escolha da tela) —
 * o que ele fez (lançamentos) e o que não fez (dias de trabalho sem nenhum lançamento). */
export async function getProductivityRange(
  user: CurrentUser,
  params: { collaboratorId: string; from: Date; to: Date },
) {
  await assertProductivityAccess(user, params.collaboratorId, VIEW_SELF_PERMISSIONS);
  const { collaborator, days } = await buildCollaboratorDays(params.collaboratorId, params.from, params.to);

  const workDays = days.filter((d) => d.status === "TRABALHO");
  const daysWithEntries = workDays.filter((d) => d.entries.length > 0);

  return {
    collaborator,
    days,
    summary: {
      workDays: workDays.length,
      daysWithEntries: daysWithEntries.length,
      daysMissing: workDays.length - daysWithEntries.length,
      totalEntries: days.reduce((sum, d) => sum + d.entries.length, 0),
    },
  };
}

type PeriodStats = {
  workDays: number;
  collaboratorsScheduled: number;
  collaboratorsLogged: number;
  totalEntries: number;
  byActivity: { activityId: string; activityName: string; unit: string | null; count: number; totalQuantity: number }[];
  missingCollaborators: { id: string; name: string }[];
};

async function computePeriodStats(
  from: Date,
  toInclusive: Date,
  collaboratorScope?: RollCallCollaboratorWhere,
): Promise<PeriodStats> {
  const rangeStart = startOfDay(from);
  const rangeEndExclusive = addDays(startOfDay(toInclusive), 1);

  const collaborators = await db.collaborator.findMany({
    where: { active: true, ...(collaboratorScope ?? {}) },
    include: { turno: { include: { scheduleType: true } } },
  });
  const collaboratorIds = collaborators.map((c) => c.id);

  const [notes, entries] = await Promise.all([
    db.scheduleDayNote.findMany({
      where: { collaboratorId: { in: collaboratorIds }, date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
    db.productivityEntry.findMany({
      where: { collaboratorId: { in: collaboratorIds }, date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { activity: true },
    }),
  ]);

  const notesByKey = new Map(notes.map((n) => [`${n.collaboratorId}|${localDateKey(n.date)}`, n]));

  let workDays = 0;
  const scheduledCollaboratorIds = new Set<string>();
  for (const c of collaborators) {
    for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
      const note = notesByKey.get(`${c.id}|${localDateKey(date)}`);
      const status = note ? note.overrideStatus : getCollaboratorDayStatus(date, c);
      if (status === "TRABALHO") {
        workDays++;
        scheduledCollaboratorIds.add(c.id);
      }
    }
  }

  const byActivityMap = new Map<string, PeriodStats["byActivity"][number]>();
  for (const e of entries) {
    const acc = byActivityMap.get(e.activityId) ?? {
      activityId: e.activity.id,
      activityName: e.activity.name,
      unit: e.activity.unit,
      count: 0,
      totalQuantity: 0,
    };
    acc.count += 1;
    acc.totalQuantity += e.quantity ?? 0;
    byActivityMap.set(e.activityId, acc);
  }

  const loggedCollaboratorIds = new Set(entries.map((e) => e.collaboratorId));

  return {
    workDays,
    collaboratorsScheduled: scheduledCollaboratorIds.size,
    collaboratorsLogged: loggedCollaboratorIds.size,
    totalEntries: entries.length,
    byActivity: Array.from(byActivityMap.values()).sort((a, b) => b.count - a.count),
    missingCollaborators: collaborators
      .filter((c) => scheduledCollaboratorIds.has(c.id) && !loggedCollaboratorIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name })),
  };
}

/** Visão geral de produtividade (hoje + mês corrente) entre todos os colaboradores ativos —
 * quantos estavam escalados pra trabalhar, quantos lançaram alguma produção, e o total por
 * atividade. Base dos cartões e da tabela no topo da tela de Produtividade. */
export async function getProductivityDashboard(user: CurrentUser, params: { date?: Date } = {}) {
  if (!hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) && !hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM)) {
    throw new ForbiddenError();
  }
  const collaboratorScope = productivityCollaboratorScopeWhere(user);
  const date = params.date ?? new Date();
  const dayStart = startOfDay(date);
  const monthStart = startOfMonth(date);
  const monthEndInclusive = addDays(startOfMonth(addMonths(date, 1)), -1);

  const [today, month] = await Promise.all([
    computePeriodStats(dayStart, dayStart, collaboratorScope),
    computePeriodStats(monthStart, monthEndInclusive, collaboratorScope),
  ]);

  return { date: dayStart, today, month };
}

// =========================================================================
// Metas mensais
// =========================================================================

export type ProductivityGoalInput = {
  collaboratorId: string;
  activityId: string;
  month: number;
  year: number;
  targetQuantity: number;
};

/** Cria ou atualiza a meta do colaborador pra aquela atividade naquele mês (uma por combinação). */
export async function upsertProductivityGoal(user: CurrentUser, data: ProductivityGoalInput) {
  await assertProductivityAccess(user, data.collaboratorId, []);

  const goal = await db.$transaction(async (tx) => {
    const upserted = await tx.productivityGoal.upsert({
      where: {
        collaboratorId_activityId_month_year: {
          collaboratorId: data.collaboratorId,
          activityId: data.activityId,
          month: data.month,
          year: data.year,
        },
      },
      create: { ...data, createdById: user.id },
      update: { targetQuantity: data.targetQuantity },
    });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "ProductivityGoal", entityId: upserted.id, newValue: data },
      tx,
    );
    return upserted;
  });

  return goal;
}

export async function deleteProductivityGoal(user: CurrentUser, id: string) {
  const goal = await db.productivityGoal.findUniqueOrThrow({ where: { id }, select: { collaboratorId: true } });
  await assertProductivityAccess(user, goal.collaboratorId, []);
  await db.productivityGoal.delete({ where: { id } });
}

/** Soma os lançamentos de um colaborador por atividade dentro do mês — usado pra calcular
 * o progresso das metas (nunca gravado como valor fixo, sempre recalculado dos lançamentos). */
async function sumEntriesByActivity(month: number, year: number, collaboratorId?: string) {
  const monthStart = new Date(year, month - 1, 1);
  const nextMonthStart = new Date(year, month, 1);
  const grouped = await db.productivityEntry.groupBy({
    by: ["collaboratorId", "activityId"],
    where: { collaboratorId, date: { gte: monthStart, lt: nextMonthStart } },
    _sum: { quantity: true },
  });
  return new Map(grouped.map((g) => [`${g.collaboratorId}|${g.activityId}`, g._sum.quantity ?? 0]));
}

/** Metas do mês de um único colaborador, já com o progresso (quanto ele produziu de cada
 * atividade no mês vs. a meta definida). */
export async function getProductivityGoalsProgress(
  user: CurrentUser,
  params: { collaboratorId: string; month: number; year: number },
) {
  await assertProductivityAccess(user, params.collaboratorId, VIEW_SELF_PERMISSIONS);

  const [goals, achievedByKey] = await Promise.all([
    db.productivityGoal.findMany({
      where: { collaboratorId: params.collaboratorId, month: params.month, year: params.year },
      include: { activity: true },
      orderBy: { activity: { name: "asc" } },
    }),
    sumEntriesByActivity(params.month, params.year, params.collaboratorId),
  ]);

  return goals.map((goal) => {
    const achieved = achievedByKey.get(`${goal.collaboratorId}|${goal.activityId}`) ?? 0;
    return {
      goal,
      achieved,
      percent: goal.targetQuantity > 0 ? Math.round((achieved / goal.targetQuantity) * 100) : 0,
    };
  });
}

/** Metas do mês de todos os colaboradores, com progresso — base da tabela "Metas do mês" no
 * topo da tela de Produtividade (visão consolidada, sem precisar escolher um colaborador). */
export async function getAllProductivityGoalsProgress(user: CurrentUser, params: { month: number; year: number }) {
  if (!hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) && !hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM)) {
    throw new ForbiddenError();
  }
  const collaboratorScope = productivityCollaboratorScopeWhere(user);

  const [goals, achievedByKey] = await Promise.all([
    db.productivityGoal.findMany({
      where: {
        month: params.month,
        year: params.year,
        collaborator: collaboratorScope ? collaboratorScope : undefined,
      },
      include: { activity: true, collaborator: true },
      orderBy: [{ collaborator: { name: "asc" } }, { activity: { name: "asc" } }],
    }),
    sumEntriesByActivity(params.month, params.year),
  ]);

  return goals.map((goal) => {
    const achieved = achievedByKey.get(`${goal.collaboratorId}|${goal.activityId}`) ?? 0;
    return {
      goal,
      achieved,
      percent: goal.targetQuantity > 0 ? Math.round((achieved / goal.targetQuantity) * 100) : 0,
    };
  });
}
