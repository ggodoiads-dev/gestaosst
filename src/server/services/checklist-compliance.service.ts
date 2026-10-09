import "server-only";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { recordAudit } from "@/server/services/audit";
import {
  CHECKLIST_JUSTIFICATION_REASONS,
  type ChecklistJustificationReason,
} from "@/domain/time-clock/checklist-justification-reasons";

/**
 * Conformidade de checklist por colaborador (não por equipamento): colaboradores marcados
 * como "Faz checklist" (`Collaborator.checklistEnabled`) devem, em todo turno escalado,
 * completar o checklist de todos os equipamentos ativos da própria área que exigem checklist
 * (têm atribuição ativa + versão publicada) — os mesmos itens que já aparecem pra ele em
 * "Realizar Checklist". Este serviço só agrega o que já existe (`ChecklistExecution`) sob a
 * ótica de "quem cumpriu", sem criar nenhuma tabela nova.
 */

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type RequiredEquipment = { id: string; code: string; name: string };

/** Equipamentos ativos que exigem checklist (atribuição ativa + versão publicada), agrupados por área. */
async function getRequiredEquipmentByArea(): Promise<Map<string, RequiredEquipment[]>> {
  const equipments = await db.equipment.findMany({
    where: {
      active: true,
      // Bloqueado / em manutenção não dá pra inspecionar — exigir esse equipamento deixava a pessoa
      // eternamente "pendente" mesmo fazendo o checklist certinho (ex: 4 bloqueados em Amarração).
      status: { notIn: ["BLOQUEADO", "EM_MANUTENCAO"] },
      assignments: { some: { active: true, template: { versions: { some: { status: "ATIVA" } } } } },
    },
    select: { id: true, code: true, name: true, areaId: true },
    orderBy: { code: "asc" },
  });

  const byArea = new Map<string, RequiredEquipment[]>();
  for (const eq of equipments) {
    byArea.set(eq.areaId, [...(byArea.get(eq.areaId) ?? []), { id: eq.id, code: eq.code, name: eq.name }]);
  }
  return byArea;
}

const collaboratorWithFunctionInclude = {
  turno: { include: { scheduleType: true } },
  area: true,
  function: { include: { requiredChecklists: { include: { template: { select: { name: true } } } } } },
} as const;

/** O que é exigido do colaborador num dia: se a função dele tiver checklist(s) obrigatório(s)
 * configurado(s) (JobFunctionRequiredChecklist), é isso especificamente — o mesmo critério já
 * usado em evaluateRange (time-clock.service.ts) pro relatório de pendência. Sem função
 * configurada, só cai no comportamento antigo (todo equipamento ativo da própria área) se
 * `Collaborator.requiresChecklist` estiver marcado — mesma flag que já era respeitada em
 * evaluateRange, mas que esta função ignorava até aqui (por isso um colaborador desmarcado como
 * "precisa de checklist", tipo Conferente, ainda aparecia cobrado pelo equipamento da área
 * inteira). O "id" de cada item, nos dois modos, é a chave usada pra bater contra as execuções
 * concluídas do dia. */
function getRequiredItemsForCollaborator(
  collaborator: {
    areaId: string | null;
    requiresChecklist: boolean;
    function: { requiredChecklists: { templateId: string; template: { name: string } }[] } | null;
  },
  requiredByArea: Map<string, RequiredEquipment[]>,
): { mode: "function" | "area" | "none"; items: RequiredEquipment[] } {
  const functionTemplates = collaborator.function?.requiredChecklists ?? [];
  if (functionTemplates.length > 0) {
    return { mode: "function", items: functionTemplates.map((r) => ({ id: r.templateId, code: r.template.name, name: r.template.name })) };
  }
  if (!collaborator.requiresChecklist) {
    return { mode: "none", items: [] };
  }
  return { mode: "area", items: collaborator.areaId ? (requiredByArea.get(collaborator.areaId) ?? []) : [] };
}

/** Último dia FECHADO (ontem, no calendário de Brasília), na mesma convenção de data do resto do serviço
 * (meia-noite "local" do servidor). A conformidade é sempre calculada até D-1: o turno de hoje ainda está
 * em andamento, e contar quem ainda não terminou como "pendente" derruba o indicador sem ninguém ter falhado. */
function lastClosedDay(): Date {
  const [y, m, d] = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd").split("-").map(Number);
  return new Date(y, m - 1, d - 1);
}

/** Instante (UTC) em que o dia de calendário `date` começa em Brasília — as execuções são carimbadas em
 * UTC, então comparar com meia-noite UTC jogava checklist feito à noite no dia errado. */
function dayStartInstant(date: Date): Date {
  return new Date(`${localDateKey(date)}T00:00:00-03:00`);
}

function brtDayKey(instant: Date): string {
  return formatInTimeZone(instant, APP_TIMEZONE, "yyyy-MM-dd");
}

export type ItemJustification = {
  itemId: string;
  reason: ChecklistJustificationReason;
  reasonLabel: string;
  countsAsCompliant: boolean;
  note: string | null;
  createdByName: string;
  createdAt: Date;
};

/** Justificativas de itens (equipamento) por "colaborador|dia". Se a tabela ainda não existir no banco (migração
 * pendente) ou a consulta falhar, devolve vazio — a aderência segue funcionando, só sem os itens justificados. */
async function loadItemJustifications(
  fromKey: string,
  toKey: string,
  collaboratorIds?: string[],
): Promise<Map<string, ItemJustification[]>> {
  const byKey = new Map<string, ItemJustification[]>();
  try {
    const rows = await db.checklistItemJustification.findMany({
      where: {
        dayKey: { gte: fromKey, lte: toKey },
        ...(collaboratorIds ? { collaboratorId: { in: collaboratorIds } } : {}),
      },
      include: { createdBy: { select: { name: true } } },
    });
    for (const r of rows) {
      const meta = CHECKLIST_JUSTIFICATION_REASONS[r.reason];
      const key = `${r.collaboratorId}|${r.dayKey}`;
      const list = byKey.get(key) ?? [];
      list.push({
        itemId: r.itemId,
        reason: r.reason,
        reasonLabel: meta.label,
        countsAsCompliant: meta.countsAsCompliant,
        note: r.note,
        createdByName: r.createdBy.name,
        createdAt: r.createdAt,
      });
      byKey.set(key, list);
    }
  } catch (error) {
    console.error("[checklist-compliance] justificativas de item indisponíveis:", error);
  }
  return byKey;
}

/** Itens do dia que contam como cumpridos por justificativa válida. */
function justifiedItemIds(justifications: ItemJustification[] | undefined): Set<string> {
  return new Set((justifications ?? []).filter((j) => j.countsAsCompliant).map((j) => j.itemId));
}

/** Quem é COBRADO por checklist: o colaborador marcado "Precisa de checklist" (RH/Supervisão) ou cuja
 * função tem checklist obrigatório. Inclui quem ainda não tem login — ele é cobrado e não consegue
 * cumprir, então entra na conta como pendente (antes era simplesmente ignorado e o número melhorava
 * de mentira). */
function listEligibleCollaboratorsQuery() {
  return db.collaborator.findMany({
    where: {
      active: true,
      OR: [{ requiresChecklist: true }, { function: { requiredChecklists: { some: {} } } }],
    },
    include: collaboratorWithFunctionInclude,
    orderBy: { name: "asc" },
  });
}

/** Monta a grade de dias de um colaborador (trabalho/folga + itens de checklist da área
 * cumpridos/pendentes naquele dia) entre duas datas (ambas inclusive). */
async function buildCollaboratorChecklistDays(collaboratorId: string, from: Date, toInclusive: Date) {
  const rangeStart = startOfDay(from);
  const rangeEndExclusive = addDays(startOfDay(toInclusive), 1);

  const [collaborator, notes, requiredByArea] = await Promise.all([
    db.collaborator.findUniqueOrThrow({
      where: { id: collaboratorId },
      include: collaboratorWithFunctionInclude,
    }),
    db.scheduleDayNote.findMany({ where: { collaboratorId, date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea(),
  ]);

  const { items: required } = getRequiredItemsForCollaborator(collaborator, requiredByArea);

  // equipmentId e checklistVersion.templateId nunca colidem (UUIDs de tabelas diferentes), então
  // dá pra jogar os dois no mesmo Set por dia sem branch por modo — o "required" de cada
  // colaborador já usa o id certo (equipamento ou template) conforme getRequiredItemsForCollaborator.
  const executions =
    collaborator.userId && required.length > 0
      ? await db.checklistExecution.findMany({
          where: {
            executedById: collaborator.userId,
            status: "CONCLUIDO",
            finishedAt: { gte: dayStartInstant(rangeStart), lt: dayStartInstant(rangeEndExclusive) },
          },
          select: { equipmentId: true, finishedAt: true, checklistVersion: { select: { templateId: true } } },
        })
      : [];

  const completedByDay = new Map<string, Set<string>>();
  for (const ex of executions) {
    const key = brtDayKey(ex.finishedAt!);
    const set = completedByDay.get(key) ?? new Set<string>();
    set.add(ex.equipmentId);
    set.add(ex.checklistVersion.templateId);
    completedByDay.set(key, set);
  }

  const notesByKey = new Map(notes.map((n) => [localDateKey(n.date), n]));
  const closedDay = lastClosedDay();
  const justificationsByKey = await loadItemJustifications(localDateKey(rangeStart), localDateKey(addDays(rangeEndExclusive, -1)), [collaboratorId]);

  const days = [];
  for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
    const key = localDateKey(date);
    const note = notesByKey.get(key) ?? null;
    const computed = getCollaboratorDayStatus(date, collaborator);
    const status = note ? note.overrideStatus : computed;
    const completedIds = new Set([
      ...(completedByDay.get(key) ?? []),
      ...justifiedItemIds(justificationsByKey.get(`${collaboratorId}|${key}`)),
    ]);
    days.push({
      date,
      status,
      // `future` = ainda não fechou (hoje e adiante): fica fora das contas de cumprimento (D-1).
      future: date > closedDay,
      required,
      completed: required.filter((e) => completedIds.has(e.id)),
      pending: required.filter((e) => !completedIds.has(e.id)),
    });
  }

  return { collaborator, days };
}

/** Relatório de conformidade de um colaborador num intervalo (dia/semana/mês) — o que ele
 * cumpriu e o que ficou pendente do checklist da própria área, dia a dia. */
export async function getChecklistComplianceRange(
  user: CurrentUser,
  params: { collaboratorId: string; from: Date; to: Date },
) {
  if (!hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) {
    const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (own?.id !== params.collaboratorId) throw new ForbiddenError();
  }
  const { collaborator, days } = await buildCollaboratorChecklistDays(params.collaboratorId, params.from, params.to);

  const workDays = days.filter((d) => d.status === "TRABALHO" && d.required.length > 0 && !d.future);
  const completeDays = workDays.filter((d) => d.pending.length === 0);

  return {
    collaborator,
    days,
    summary: {
      workDays: workDays.length,
      completeDays: completeDays.length,
      incompleteDays: workDays.length - completeDays.length,
    },
  };
}

type PeriodComplianceStats = {
  collaboratorsScheduled: number;
  collaboratorsComplete: number;
  collaboratorsIncomplete: { id: string; name: string; pendingCount: number; noAccess: boolean }[];
  /** Turnos (pessoa × dia escalado) com checklist cobrado, e quantos foram cumpridos — base da % de aderência. */
  shiftsRequired: number;
  shiftsComplete: number;
};

/** Aderência por COLABORADOR: dos turnos em que alguém era cobrado por checklist, quantos foram cumpridos
 * por essa pessoa (no login dela). `null` quando ninguém era cobrado no período. */
export function compliancePercent(stats: Pick<PeriodComplianceStats, "shiftsRequired" | "shiftsComplete">): number | null {
  return stats.shiftsRequired === 0 ? null : Math.round((stats.shiftsComplete / stats.shiftsRequired) * 100);
}

async function computeCompliancePeriodStats(from: Date, toInclusive: Date): Promise<PeriodComplianceStats> {
  const rangeStart = startOfDay(from);
  const closedDay = lastClosedDay();
  // Só conta dias já fechados (até ontem): turno de hoje está em andamento e o futuro nem aconteceu.
  const rangeEndExclusive = addDays(startOfDay(toInclusive) < closedDay ? startOfDay(toInclusive) : closedDay, 1);
  if (rangeStart >= rangeEndExclusive) {
    return { collaboratorsScheduled: 0, collaboratorsComplete: 0, collaboratorsIncomplete: [], shiftsRequired: 0, shiftsComplete: 0 };
  }

  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea(),
  ]);

  const requiredByCollaborator = new Map(collaborators.map((c) => [c.id, getRequiredItemsForCollaborator(c, requiredByArea)]));
  const eligible = collaborators.filter((c) => (requiredByCollaborator.get(c.id)?.items.length ?? 0) > 0);
  const userIds = eligible.filter((c) => c.userId).map((c) => c.userId!);

  const executions =
    userIds.length > 0
      ? await db.checklistExecution.findMany({
          where: {
            executedById: { in: userIds },
            status: "CONCLUIDO",
            finishedAt: { gte: dayStartInstant(rangeStart), lt: dayStartInstant(rangeEndExclusive) },
          },
          select: { executedById: true, equipmentId: true, finishedAt: true, checklistVersion: { select: { templateId: true } } },
        })
      : [];

  // equipmentId e checklistVersion.templateId nunca colidem (UUIDs de tabelas diferentes) — dá pra
  // guardar os dois no mesmo Set por pessoa/dia sem precisar ramificar por modo mais abaixo.
  const completedByKey = new Map<string, Set<string>>();
  for (const ex of executions) {
    const key = `${ex.executedById}|${brtDayKey(ex.finishedAt!)}`;
    const set = completedByKey.get(key) ?? new Set<string>();
    set.add(ex.equipmentId);
    set.add(ex.checklistVersion.templateId);
    completedByKey.set(key, set);
  }

  const notesByKey = new Map(notes.map((n) => [`${n.collaboratorId}|${localDateKey(n.date)}`, n]));
  const justificationsByKey = await loadItemJustifications(
    localDateKey(rangeStart),
    localDateKey(addDays(rangeEndExclusive, -1)),
    eligible.map((c) => c.id),
  );

  let scheduledCount = 0;
  let shiftsRequired = 0;
  let shiftsComplete = 0;
  const incomplete: PeriodComplianceStats["collaboratorsIncomplete"] = [];

  for (const c of eligible) {
    const required = requiredByCollaborator.get(c.id)!.items;
    let scheduledAnyDay = false;
    let pendingTotal = 0;

    for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
      const dayKey = localDateKey(date);
      const note = notesByKey.get(`${c.id}|${dayKey}`);
      const computed = getCollaboratorDayStatus(date, c);
      const status = note ? note.overrideStatus : computed;
      if (status !== "TRABALHO") continue;
      scheduledAnyDay = true;
      // Sem login não há como cumprir: tudo que é cobrado fica pendente.
      const completedIds = new Set([
        ...(c.userId ? (completedByKey.get(`${c.userId}|${dayKey}`) ?? []) : []),
        ...justifiedItemIds(justificationsByKey.get(`${c.id}|${dayKey}`)),
      ]);
      const pendingToday = required.filter((e) => !completedIds.has(e.id)).length;
      pendingTotal += pendingToday;
      shiftsRequired++;
      if (pendingToday === 0) shiftsComplete++;
    }

    if (!scheduledAnyDay) continue;
    scheduledCount++;
    if (pendingTotal > 0) incomplete.push({ id: c.id, name: c.name, pendingCount: pendingTotal, noAccess: !c.userId });
  }

  return {
    collaboratorsScheduled: scheduledCount,
    collaboratorsComplete: scheduledCount - incomplete.length,
    collaboratorsIncomplete: incomplete,
    shiftsRequired,
    shiftsComplete,
  };
}

export type TodayProgressEntry = {
  id: string;
  name: string;
  areaName: string | null;
  done: number;
  required: number;
  noAccess: boolean;
  /** Equipamentos que ainda faltam hoje (vazio quando concluiu). */
  missing: { id: string; code: string }[];
};

/** Andamento de HOJE (informativo — NÃO entra na % de aderência, que é sempre até D-1): de quem está escalado
 * e é cobrado por checklist, quem já concluiu tudo e quem ainda falta. */
async function computeTodayProgress(): Promise<{ dayKey: string; concluded: TodayProgressEntry[]; remaining: TodayProgressEntry[] }> {
  const today = addDays(lastClosedDay(), 1);
  const tomorrow = addDays(today, 1);
  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    getRequiredEquipmentByArea(),
  ]);
  const noteByCollab = new Map(notes.map((n) => [n.collaboratorId, n]));

  const rows = collaborators
    .map((c) => ({ c, required: getRequiredItemsForCollaborator(c, requiredByArea).items }))
    .filter(({ c, required }) => {
      if (required.length === 0) return false;
      const note = noteByCollab.get(c.id);
      return (note ? note.overrideStatus : getCollaboratorDayStatus(today, c)) === "TRABALHO";
    });

  const userIds = rows.filter(({ c }) => c.userId).map(({ c }) => c.userId!);
  const executions =
    userIds.length > 0
      ? await db.checklistExecution.findMany({
          where: {
            executedById: { in: userIds },
            status: "CONCLUIDO",
            finishedAt: { gte: dayStartInstant(today), lt: dayStartInstant(tomorrow) },
          },
          select: { executedById: true, equipmentId: true, checklistVersion: { select: { templateId: true } } },
        })
      : [];
  const doneByUser = new Map<string, Set<string>>();
  for (const ex of executions) {
    const set = doneByUser.get(ex.executedById) ?? new Set<string>();
    set.add(ex.equipmentId);
    set.add(ex.checklistVersion.templateId);
    doneByUser.set(ex.executedById, set);
  }

  const todayKey = localDateKey(today);
  const justificationsByKey = await loadItemJustifications(todayKey, todayKey, rows.map(({ c }) => c.id));
  const concluded: TodayProgressEntry[] = [];
  const remaining: TodayProgressEntry[] = [];
  for (const { c, required } of rows) {
    const doneIds = new Set([
      ...(c.userId ? (doneByUser.get(c.userId) ?? []) : []),
      ...justifiedItemIds(justificationsByKey.get(`${c.id}|${todayKey}`)),
    ]);
    const missing = required.filter((e) => !doneIds.has(e.id)).map((e) => ({ id: e.id, code: e.code }));
    const entry: TodayProgressEntry = {
      id: c.id,
      name: c.name,
      areaName: c.area?.name ?? null,
      done: required.length - missing.length,
      required: required.length,
      noAccess: !c.userId,
      missing,
    };
    (missing.length === 0 ? concluded : remaining).push(entry);
  }
  concluded.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  remaining.sort((a, b) => b.required - b.done - (a.required - a.done) || a.name.localeCompare(b.name, "pt-BR"));
  return { dayKey: todayKey, concluded, remaining };
}

/** Visão geral (ontem + mês corrente, sempre até D-1) de quantos colaboradores com checklist obrigatório
 * cumpriram tudo vs. ficaram com pendência — base do dashboard de conformidade de checklist. O bloco
 * `today` guarda o ÚLTIMO DIA FECHADO (ontem); `date` é esse dia. */
export async function getChecklistComplianceDashboard(user: CurrentUser, params: { date?: Date } = {}) {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const date = params.date ?? new Date();
  const dayStart = lastClosedDay();
  const monthStart = startOfMonth(date);
  const monthEndInclusive = addDays(startOfMonth(addMonths(date, 1)), -1);

  const [today, month, todayProgress] = await Promise.all([
    computeCompliancePeriodStats(dayStart, dayStart),
    computeCompliancePeriodStats(monthStart, monthEndInclusive),
    computeTodayProgress(),
  ]);

  return { date: dayStart, today, month, todayProgress, canJustify: canJustifyChecklist(user) };
}

export type DayExecutionAnswer = {
  question: string;
  value: string | null;
  comment: string | null;
  critical: boolean;
  photos: { id: string; filename: string; path: string }[];
};

export type DayExecutionDetail = {
  id: string;
  code: string;
  equipmentCode: string;
  equipmentName: string;
  finishedAt: Date;
  result: string | null;
  answers: DayExecutionAnswer[];
};

const FIXED_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  SIM: "Sim",
  NAO: "Não",
  BOM: "Bom",
  REGULAR: "Regular",
  RUIM: "Ruim",
  CONFIRMADO: "Confirmado",
  NAO_APLICAVEL: "N/A",
};

/** Detalhe de um dia de um colaborador: o que cada equipamento exigido recebeu de checklist (com as respostas,
 * comentários e fotos) e o que ficou faltando. `dayKey` = "yyyy-MM-dd" no calendário de Brasília. */
export async function getCollaboratorChecklistDayDetail(
  user: CurrentUser,
  params: { collaboratorId: string; dayKey: string },
) {
  if (!hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) {
    const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (own?.id !== params.collaboratorId) throw new ForbiddenError();
  }
  const [y, m, d] = params.dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const next = addDays(date, 1);

  const [collaborator, requiredByArea] = await Promise.all([
    db.collaborator.findUniqueOrThrow({ where: { id: params.collaboratorId }, include: collaboratorWithFunctionInclude }),
    getRequiredEquipmentByArea(),
  ]);
  const { items: required } = getRequiredItemsForCollaborator(collaborator, requiredByArea);

  const rawExecutions = collaborator.userId
    ? await db.checklistExecution.findMany({
        where: {
          executedById: collaborator.userId,
          status: "CONCLUIDO",
          finishedAt: { gte: dayStartInstant(date), lt: dayStartInstant(next) },
        },
        orderBy: { finishedAt: "asc" },
        select: {
          id: true,
          code: true,
          result: true,
          finishedAt: true,
          equipment: { select: { id: true, code: true, name: true } },
          checklistVersion: { select: { templateId: true } },
          answers: {
            orderBy: { question: { order: "asc" } },
            select: {
              value: true,
              comment: true,
              isCritical: true,
              question: { select: { title: true, options: { select: { value: true, label: true } } } },
              attachments: { select: { id: true, filename: true, path: true } },
            },
          },
        },
      })
    : [];

  const executions = rawExecutions.map((ex) => ({
    detail: {
      id: ex.id,
      code: ex.code,
      equipmentCode: ex.equipment.code,
      equipmentName: ex.equipment.name,
      finishedAt: ex.finishedAt!,
      result: ex.result,
      answers: ex.answers.map((a) => ({
        question: a.question.title,
        value:
          a.value == null
            ? null
            : (a.question.options.find((o) => o.value === a.value)?.label ?? FIXED_LABELS[a.value] ?? a.value),
        comment: a.comment,
        critical: a.isCritical,
        photos: a.attachments,
      })),
    } satisfies DayExecutionDetail,
    keys: [ex.equipment.id, ex.checklistVersion.templateId],
  }));

  const justificationsByKey = await loadItemJustifications(params.dayKey, params.dayKey, [params.collaboratorId]);
  const dayJustifications = justificationsByKey.get(`${params.collaboratorId}|${params.dayKey}`) ?? [];
  const justifiedIds = justifiedItemIds(dayJustifications);
  const doneIds = new Set([...executions.flatMap((e) => e.keys), ...justifiedIds]);
  const missing = required.filter((e) => !doneIds.has(e.id));
  const justified = required
    .filter((e) => justifiedIds.has(e.id) && !executions.some((x) => x.keys.includes(e.id)))
    .map((e) => ({ ...e, justification: dayJustifications.find((j) => j.itemId === e.id)! }));
  // Justificativa que não conta como cumprido (ex: "Outro") fica visível junto do item que continua faltando.
  const notCounting = new Map(dayJustifications.filter((j) => !j.countsAsCompliant).map((j) => [j.itemId, j]));
  return {
    collaborator: { id: collaborator.id, name: collaborator.name, area: collaborator.area?.name ?? null, hasLogin: !!collaborator.userId },
    required: required.length,
    doneCount: required.length - missing.length,
    missing: missing.map((e) => ({ ...e, note: notCounting.get(e.id) ?? null })),
    justified,
    executions: executions.map((e) => e.detail),
    canJustify: canJustifyChecklist(user),
  };
}

/** Justificar um item não feito é ESCRITA — só RH ou quem gerencia plano de ação (o Auditor, só-leitura, não). */
export function canJustifyChecklist(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.HR_MANAGE) || hasPermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);
}

/** Registra (ou troca) a justificativa de um equipamento que o colaborador não fez no dia. Se o motivo conta como
 * cumprido, o item passa a entrar como concluído na aderência. */
export async function justifyChecklistItem(
  user: CurrentUser,
  input: { collaboratorId: string; dayKey: string; itemIds: string[]; reason: ChecklistJustificationReason; note: string },
) {
  if (!canJustifyChecklist(user)) throw new ForbiddenError();
  if (input.itemIds.length === 0) throw new Error("Escolha ao menos um equipamento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) throw new Error("Data inválida.");
  const note = input.note.trim();
  if (note.length < 3) throw new Error("Explique o motivo em poucas palavras.");

  const collaborator = await db.collaborator.findUniqueOrThrow({
    where: { id: input.collaboratorId },
    include: collaboratorWithFunctionInclude,
  });
  // Supervisor sem visão consolidada só justifica gente da própria área.
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE) && !hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) {
    if (!collaborator.areaId || !user.areaIds.has(collaborator.areaId)) throw new ForbiddenError();
  }
  // Só dá pra justificar o que era realmente exigido dele.
  const { items } = getRequiredItemsForCollaborator(collaborator, await getRequiredEquipmentByArea());
  const requiredIds = new Set(items.map((i) => i.id));
  if (input.itemIds.some((id) => !requiredIds.has(id))) throw new Error("Esse item não era exigido desse colaborador.");

  for (const itemId of new Set(input.itemIds)) {
    const saved = await db.checklistItemJustification.upsert({
      where: { collaboratorId_dayKey_itemId: { collaboratorId: input.collaboratorId, dayKey: input.dayKey, itemId } },
      update: { reason: input.reason, note, createdById: user.id },
      create: { collaboratorId: input.collaboratorId, dayKey: input.dayKey, itemId, reason: input.reason, note, createdById: user.id },
    });
    await recordAudit({
      userId: user.id,
      action: "CREATE",
      entityType: "ChecklistItemJustification",
      entityId: saved.id,
      newValue: { collaboratorId: input.collaboratorId, dayKey: input.dayKey, itemId, reason: input.reason, note },
    });
  }
}

/** Desfaz uma justificativa de item (o equipamento volta a constar como faltando). */
export async function removeChecklistItemJustification(
  user: CurrentUser,
  input: { collaboratorId: string; dayKey: string; itemId: string },
) {
  if (!canJustifyChecklist(user)) throw new ForbiddenError();
  const key = { collaboratorId: input.collaboratorId, dayKey: input.dayKey, itemId: input.itemId };
  const existing = await db.checklistItemJustification.findUnique({ where: { collaboratorId_dayKey_itemId: key } });
  if (!existing) return;
  await db.checklistItemJustification.delete({ where: { id: existing.id } });
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "ChecklistItemJustification",
    entityId: existing.id,
    previousValue: { ...key, reason: existing.reason, note: existing.note },
  });
}
