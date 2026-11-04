import "server-only";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";

/** Dia de trabalho de quem é cobrado. Sem turno/escala cadastrada não dá pra saber a folga: conta como dia útil (seg-sex),
 * em vez de "nunca trabalha" — que fazia a pessoa sumir da cobrança e dos indicadores. */
function dayStatusFor(date: Date, c: Parameters<typeof getCollaboratorDayStatus>[1]): "TRABALHO" | "FOLGA" {
  if (c.turno) return getCollaboratorDayStatus(date, c);
  const weekday = date.getDay();
  return weekday >= 1 && weekday <= 5 ? "TRABALHO" : "FOLGA";
}
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";
import { recordAudit } from "@/server/services/audit";
import { isChecklistInfraction } from "@/domain/discipline/ladder";
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
async function getRequiredEquipmentByArea(options: { includeUnavailable?: boolean } = {}): Promise<Map<string, RequiredEquipment[]>> {
  const equipments = await db.equipment.findMany({
    where: {
      active: true,
      // Bloqueado / em manutenção não dá pra inspecionar — exigir esse equipamento deixava a pessoa
      // eternamente "pendente" mesmo fazendo o checklist certinho (ex: 4 bloqueados em Amarração).
      ...(options.includeUnavailable ? {} : { status: { notIn: ["BLOQUEADO", "EM_MANUTENCAO"] } }),
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

/** Eventos que tiram/devolvem o equipamento de uso. */
const UNAVAILABLE_START_EVENTS = ["EQUIPAMENTO_BLOQUEADO", "MANUTENCAO_INICIADA"] as const;
const UNAVAILABLE_END_EVENTS = ["EQUIPAMENTO_LIBERADO", "MANUTENCAO_CONCLUIDA"] as const;

/** Disponibilidade HISTÓRICA dos equipamentos: o equipamento que estava bloqueado/em manutenção em um dia não podia ser
 * inspecionado nele, então não deve ficar "pendente" naquele dia — mesmo que tenha sido liberado depois (o status de
 * hoje não vale pra dias passados). Reconstrói os períodos a partir do histórico (bloqueio/manutenção → liberação) e
 * devolve `(equipamento, dia) => indisponível em algum momento do dia?`. Quem está bloqueado agora sem histórico
 * registrado conta como indisponível desde sempre (comportamento anterior). Se a consulta falhar, ninguém é isentado. */
async function loadUnavailability(upToDayKey: string): Promise<(equipmentId: string, dayKey: string) => boolean> {
  try {
    const upTo = new Date(`${upToDayKey}T23:59:59.999-03:00`);
    const [events, currentlyUnavailable] = await Promise.all([
      db.equipmentEvent.findMany({
        where: { type: { in: [...UNAVAILABLE_START_EVENTS, ...UNAVAILABLE_END_EVENTS] }, occurredAt: { lte: upTo } },
        orderBy: { occurredAt: "asc" },
        select: { equipmentId: true, type: true, occurredAt: true },
      }),
      db.equipment.findMany({ where: { status: { in: ["BLOQUEADO", "EM_MANUTENCAO"] } }, select: { id: true } }),
    ]);

    type Interval = { start: number; end: number | null };
    const byEquipment = new Map<string, Interval[]>();
    const lastEventAt = new Map<string, number>();
    // Dois "motivos" independentes: bloqueio (até ser liberado) e manutenção (até ser concluída). Concluir a manutenção
    // não libera um equipamento que continua bloqueado por uma não conformidade — só o evento de liberação faz isso.
    const state = new Map<string, { blocked: boolean; maintenance: boolean }>();
    for (const e of events) {
      const t = e.occurredAt.getTime();
      lastEventAt.set(e.equipmentId, t);
      const st = state.get(e.equipmentId) ?? { blocked: false, maintenance: false };
      const wasUnavailable = st.blocked || st.maintenance;
      if (e.type === "EQUIPAMENTO_BLOQUEADO") st.blocked = true;
      else if (e.type === "MANUTENCAO_INICIADA") st.maintenance = true;
      else if (e.type === "MANUTENCAO_CONCLUIDA") st.maintenance = false;
      else if (e.type === "EQUIPAMENTO_LIBERADO") {
        st.blocked = false;
        st.maintenance = false;
      }
      state.set(e.equipmentId, st);
      const isUnavailable = st.blocked || st.maintenance;
      const list = byEquipment.get(e.equipmentId) ?? [];
      if (!wasUnavailable && isUnavailable) list.push({ start: t, end: null });
      else if (wasUnavailable && !isUnavailable && list.length > 0) list[list.length - 1].end = t;
      byEquipment.set(e.equipmentId, list);
    }
    // Bloqueado agora mas sem período aberto no histórico (ex: status mudado direto no cadastro).
    for (const { id } of currentlyUnavailable) {
      const list = byEquipment.get(id) ?? [];
      const open = list[list.length - 1];
      if (!open || open.end !== null) list.push({ start: lastEventAt.get(id) ?? 0, end: null });
      byEquipment.set(id, list);
    }

    return (equipmentId, dayKey) => {
      const intervals = byEquipment.get(equipmentId);
      if (!intervals) return false;
      const dayStart = new Date(`${dayKey}T00:00:00-03:00`).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      return intervals.some((i) => i.start < dayEnd && (i.end === null || i.end > dayStart));
    };
  } catch (error) {
    console.error("[checklist-compliance] histórico de disponibilidade indisponível:", error);
    return () => false;
  }
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
    /** "Faz checklist?" — quem tem essa marcação também é cobrado. */
    checklistEnabled?: boolean;
    function: { requiredChecklists: { templateId: string; template: { name: string } }[] } | null;
  },
  requiredByArea: Map<string, RequiredEquipment[]>,
): { mode: "function" | "area" | "none"; items: RequiredEquipment[] } {
  const functionTemplates = collaborator.function?.requiredChecklists ?? [];
  if (functionTemplates.length > 0) {
    return { mode: "function", items: functionTemplates.map((r) => ({ id: r.templateId, code: r.template.name, name: r.template.name })) };
  }
  if (!collaborator.requiresChecklist && !collaborator.checklistEnabled) {
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
      // "Faz checklist?" (login pra fazer checklist) OU "Precisa de checklist" OU função com checklist obrigatório.
      OR: [{ checklistEnabled: true }, { requiresChecklist: true }, { function: { requiredChecklists: { some: {} } } }],
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
    getRequiredEquipmentByArea({ includeUnavailable: true }),
  ]);

  const { items: required } = getRequiredItemsForCollaborator(collaborator, requiredByArea);
  const unavailable = await loadUnavailability(localDateKey(addDays(rangeEndExclusive, -1)));

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
    const computed = dayStatusFor(date, collaborator);
    const status = note ? note.overrideStatus : computed;
    const completedIds = new Set([
      ...(completedByDay.get(key) ?? []),
      ...justifiedItemIds(justificationsByKey.get(`${collaboratorId}|${key}`)),
    ]);
    // Equipamento bloqueado/em manutenção naquele dia não podia ser inspecionado: não era exigido (nem feito, nem pendente).
    const dayRequired = required.filter((e) => !unavailable(e.id, key));
    days.push({
      date,
      status,
      // `future` = ainda não fechou (hoje e adiante): fica fora das contas de cumprimento (D-1).
      future: date > closedDay,
      required: dayRequired,
      completed: dayRequired.filter((e) => completedIds.has(e.id)),
      pending: dayRequired.filter((e) => !completedIds.has(e.id)),
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
  /** Por pessoa: turnos cobrados e cumpridos no período (base da lista de Mês/Ano). */
  people: PeriodPerson[];
};

export type PeriodPerson = {
  id: string;
  name: string;
  areaName: string | null;
  noAccess: boolean;
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
    return { collaboratorsScheduled: 0, collaboratorsComplete: 0, collaboratorsIncomplete: [], shiftsRequired: 0, shiftsComplete: 0, people: [] };
  }

  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea({ includeUnavailable: true }),
  ]);
  const unavailable = await loadUnavailability(localDateKey(addDays(rangeEndExclusive, -1)));

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
  const people: PeriodPerson[] = [];

  for (const c of eligible) {
    const required = requiredByCollaborator.get(c.id)!.items;
    let scheduledAnyDay = false;
    let pendingTotal = 0;
    let personRequired = 0;
    let personComplete = 0;

    for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
      const dayKey = localDateKey(date);
      const note = notesByKey.get(`${c.id}|${dayKey}`);
      const computed = dayStatusFor(date, c);
      const status = note ? note.overrideStatus : computed;
      if (status !== "TRABALHO") continue;
      // Equipamento bloqueado/em manutenção naquele dia não podia ser inspecionado: não era exigido. Se nada era exigível, não há turno cobrado.
      const dayRequired = required.filter((e) => !unavailable(e.id, dayKey));
      if (dayRequired.length === 0) continue;
      scheduledAnyDay = true;
      // Sem login não há como cumprir: tudo que é cobrado fica pendente.
      const completedIds = new Set([
        ...(c.userId ? (completedByKey.get(`${c.userId}|${dayKey}`) ?? []) : []),
        ...justifiedItemIds(justificationsByKey.get(`${c.id}|${dayKey}`)),
      ]);
      const pendingToday = dayRequired.filter((e) => !completedIds.has(e.id)).length;
      pendingTotal += pendingToday;
      shiftsRequired++;
      personRequired++;
      if (pendingToday === 0) {
        shiftsComplete++;
        personComplete++;
      }
    }

    if (!scheduledAnyDay) continue;
    people.push({
      id: c.id,
      name: c.name,
      areaName: c.area?.name ?? null,
      noAccess: !c.userId,
      shiftsRequired: personRequired,
      shiftsComplete: personComplete,
    });
    scheduledCount++;
    if (pendingTotal > 0) incomplete.push({ id: c.id, name: c.name, pendingCount: pendingTotal, noAccess: !c.userId });
  }

  return {
    collaboratorsScheduled: scheduledCount,
    collaboratorsComplete: scheduledCount - incomplete.length,
    collaboratorsIncomplete: incomplete,
    shiftsRequired,
    shiftsComplete,
    people,
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
  /** Quantos itens do dia contam como concluídos só por justificativa (dá pra desfazer). */
  justified: number;
};

/** Andamento de HOJE (informativo — NÃO entra na % de aderência, que é sempre até D-1): de quem está escalado
 * e é cobrado por checklist, quem já concluiu tudo e quem ainda falta. */
/** `FALTA` = falta lançada (gera advertência por falta, outra escada); `AUSENCIA` = folga, férias, atestado — sem medida. */
export type DayOffEntry = { id: string; name: string; areaName: string | null; reason: string; kind: "FALTA" | "AUSENCIA" };

async function computeDayProgress(
  day: Date,
): Promise<{ dayKey: string; concluded: TodayProgressEntry[]; remaining: TodayProgressEntry[]; off: DayOffEntry[] }> {
  const today = day;
  const tomorrow = addDays(today, 1);
  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: today, lt: tomorrow } } }),
    getRequiredEquipmentByArea({ includeUnavailable: true }),
  ]);
  const unavailable = await loadUnavailability(localDateKey(today));
  const noteByCollab = new Map(notes.map((n) => [n.collaboratorId, n]));

  const withItems = collaborators
    .map((c) => ({ c, required: getRequiredItemsForCollaborator(c, requiredByArea).items }))
    .filter(({ required }) => required.length > 0);
  const isWorking = (c: (typeof collaborators)[number]) => {
    const note = noteByCollab.get(c.id);
    return (note ? note.overrideStatus : dayStatusFor(today, c)) === "TRABALHO";
  };
  const rows = withItems.filter(({ c }) => isWorking(c));
  // Cobrados que NÃO entram hoje porque não estão escalados (folga na escala, ou ausência/folga lançada no dia).
  const off: DayOffEntry[] = withItems
    .filter(({ c }) => !isWorking(c))
    .map(({ c }) => {
      const note = noteByCollab.get(c.id);
      const label = note?.status === "FALTA" ? "falta lançada" : note?.status === "ATESTADO" ? "atestado" : note?.status === "FERIAS" ? "férias" : note ? "folga/ausência lançada" : "folga na escala";
      return { id: c.id, name: c.name, areaName: c.area?.name ?? null, reason: label, kind: note?.status === "FALTA" ? ("FALTA" as const) : ("AUSENCIA" as const) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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
    const executedNow = new Set(c.userId ? (doneByUser.get(c.userId) ?? []) : []);
    const justifiedNow = justifiedItemIds(justificationsByKey.get(`${c.id}|${todayKey}`));
    const doneIds = new Set([...executedNow, ...justifiedNow]);
    // Equipamento bloqueado/em manutenção no dia não podia ser inspecionado: sai da conta (nem feito, nem pendente) — igual ao detalhe.
    const dayRequired = required.filter((e) => !unavailable(e.id, todayKey));
    if (dayRequired.length === 0) continue;
    const missing = dayRequired.filter((e) => !doneIds.has(e.id)).map((e) => ({ id: e.id, code: e.code }));
    const entry: TodayProgressEntry = {
      id: c.id,
      name: c.name,
      areaName: c.area?.name ?? null,
      done: dayRequired.length - missing.length,
      required: dayRequired.length,
      noAccess: !c.userId,
      missing,
      justified: dayRequired.filter((e) => justifiedNow.has(e.id) && !executedNow.has(e.id)).length,
    };
    (missing.length === 0 ? concluded : remaining).push(entry);
  }
  concluded.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  remaining.sort((a, b) => b.required - b.done - (a.required - a.done) || a.name.localeCompare(b.name, "pt-BR"));
  return { dayKey: todayKey, concluded, remaining, off };
}

/** Dias depois da virada do mês antes de travar o resultado: dá tempo de o RH justificar itens do fim do mês. */
const FREEZE_GRACE_DAYS = 2;

type ComplianceSnapshotData = { today: PeriodComplianceStats; month: PeriodComplianceStats };

/** Leitura tolerante: se a tabela ainda não existir no banco, vale o cálculo na hora. */
async function loadComplianceSnapshot(month: string): Promise<ComplianceSnapshotData | null> {
  try {
    const row = await db.checklistComplianceSnapshot.findUnique({ where: { month } });
    return row ? (row.data as unknown as ComplianceSnapshotData) : null;
  } catch (error) {
    console.error("[checklist-compliance] fechamentos de mês indisponíveis:", error);
    return null;
  }
}

/** O mês já pode ser travado? Sim, depois de `FREEZE_GRACE_DAYS` dias da virada (calendário de Brasília). */
function canFreezeMonth(month: string, now: Date = new Date()): boolean {
  const [y, m] = month.split("-").map(Number);
  const freezeFrom = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-${String(1 + FREEZE_GRACE_DAYS).padStart(2, "0")}`;
  return formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd") >= freezeFrom;
}

/** Reabre um mês travado (apaga o fechamento): na próxima consulta ele é recalculado e travado de novo. */
export async function reopenChecklistComplianceMonth(user: CurrentUser, month: string) {
  if (!canJustifyChecklist(user)) throw new ForbiddenError();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
  await db.checklistComplianceSnapshot.deleteMany({ where: { month } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "ChecklistComplianceSnapshot", entityId: month, previousValue: { month } });
}

/** Visão geral (ontem + mês corrente, sempre até D-1) de quantos colaboradores com checklist obrigatório
 * cumpriram tudo vs. ficaram com pendência — base do dashboard de conformidade de checklist. O bloco
 * `today` guarda o ÚLTIMO DIA FECHADO (ontem); `date` é esse dia. Mês passado: depois da carência da virada o resultado
 * é TRAVADO (`frozen`) e não muda mais com justificativa, cadastro ou escala editados depois; para recalcular, `reopenChecklistComplianceMonth`. */
/** Aderência (%) de checklist entre duas datas (inclusive), para comparar o mês em andamento com o mesmo ponto do mês passado. `null` se ninguém era cobrado. */
export async function getChecklistPercentBetween(user: CurrentUser, from: Date, toInclusive: Date): Promise<number | null> {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  return compliancePercent(await computeCompliancePeriodStats(from, toInclusive));
}

export async function getChecklistComplianceDashboard(user: CurrentUser, params: { date?: Date; month?: string } = {}) {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  // `month` ("AAAA-MM") pede um mês JÁ FECHADO: o bloco "último dia" passa a ser o último dia daquele mês e o bloco do mês cobre ele inteiro.
  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const pastMonth = params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) && params.month < nowKey ? params.month : null;
  const date = pastMonth ? new Date(Number(pastMonth.slice(0, 4)), Number(pastMonth.slice(5, 7)) - 1, 15) : (params.date ?? new Date());
  const dayStart = pastMonth ? new Date(Number(pastMonth.slice(0, 4)), Number(pastMonth.slice(5, 7)), 0) : lastClosedDay();
  const monthStart = startOfMonth(date);
  const monthEndInclusive = addDays(startOfMonth(addMonths(date, 1)), -1);

  const snapshot = pastMonth ? await loadComplianceSnapshot(pastMonth) : null;
  const [today, month, todayProgress] = await Promise.all([
    snapshot ? Promise.resolve(snapshot.today) : computeCompliancePeriodStats(dayStart, dayStart),
    snapshot ? Promise.resolve(snapshot.month) : computeCompliancePeriodStats(monthStart, monthEndInclusive),
    computeDayProgress(addDays(lastClosedDay(), 1)),
  ]);

  let frozen = !!snapshot;
  if (pastMonth && !snapshot && canFreezeMonth(pastMonth)) {
    try {
      await db.checklistComplianceSnapshot.create({ data: { month: pastMonth, data: JSON.parse(JSON.stringify({ today, month })) } });
      frozen = true;
    } catch (error) {
      console.error("[checklist-compliance] não consegui travar o mês", pastMonth, error);
    }
  }

  return { date: dayStart, today, month, todayProgress, canJustify: canJustifyChecklist(user), monthKey: pastMonth ?? nowKey, isPastMonth: !!pastMonth, frozen };
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
    getRequiredEquipmentByArea({ includeUnavailable: true }),
  ]);
  const { items: required } = getRequiredItemsForCollaborator(collaborator, requiredByArea);
  const unavailable = await loadUnavailability(params.dayKey);

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
  // Equipamento bloqueado/em manutenção no dia não podia ser inspecionado: conta como concluído, não pendente.
  const unavailableIds = new Set(required.filter((e) => unavailable(e.id, params.dayKey)).map((e) => e.id));
  const dayRequired = required.filter((e) => !unavailableIds.has(e.id));
  const doneIds = new Set([...executions.flatMap((e) => e.keys), ...justifiedIds]);
  const missing = dayRequired.filter((e) => !doneIds.has(e.id));
  const justified = dayRequired
    .filter((e) => justifiedIds.has(e.id) && !executions.some((x) => x.keys.includes(e.id)))
    .map((e) => ({ ...e, justification: dayJustifications.find((j) => j.itemId === e.id)! }));
  // Justificativa que não conta como cumprido (ex: "Outro") fica visível junto do item que continua faltando.
  const notCounting = new Map(dayJustifications.filter((j) => !j.countsAsCompliant).map((j) => [j.itemId, j]));
  return {
    collaborator: { id: collaborator.id, name: collaborator.name, area: collaborator.area?.name ?? null, hasLogin: !!collaborator.userId },
    required: dayRequired.length,
    /** Equipamentos bloqueados/em manutenção no dia: não eram exigidos e ficam fora da conta. */
    unavailableCount: unavailableIds.size,
    doneCount: dayRequired.length - missing.length,
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
  const { items } = getRequiredItemsForCollaborator(collaborator, await getRequiredEquipmentByArea({ includeUnavailable: true }));
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

/** Desfaz justificativas de um colaborador num dia: as de `itemIds` ou, sem lista, todas do dia. Devolve quantas foram desfeitas. */
export async function removeChecklistItemJustifications(
  user: CurrentUser,
  input: { collaboratorId: string; dayKey: string; itemIds?: string[] },
) {
  if (!canJustifyChecklist(user)) throw new ForbiddenError();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) throw new Error("Data inválida.");
  const rows = await db.checklistItemJustification.findMany({
    where: {
      collaboratorId: input.collaboratorId,
      dayKey: input.dayKey,
      ...(input.itemIds && input.itemIds.length > 0 ? { itemId: { in: input.itemIds } } : {}),
    },
  });
  if (rows.length === 0) return 0;
  await db.checklistItemJustification.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "ChecklistItemJustification",
    entityId: rows[0].id,
    previousValue: {
      collaboratorId: input.collaboratorId,
      dayKey: input.dayKey,
      removed: rows.map((r) => ({ itemId: r.itemId, reason: r.reason, note: r.note })),
    },
  });
  return rows.length;
}

export type ComplianceExplorerPeriod = "dia" | "mes" | "ano";

/** Consulta livre por período (dia, mês ou ano) — mesma regra de aderência, sempre limitada a ontem (D-1).
 * `dia`: quem concluiu/faltou naquele dia (hoje = andamento). `mes`/`ano`: turnos cumpridos por pessoa. */
export async function getChecklistComplianceExplorer(
  user: CurrentUser,
  params: { period: ComplianceExplorerPeriod; refKey: string },
) {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const closedDay = lastClosedDay();
  const today = addDays(closedDay, 1);
  const [y, m, d] = params.refKey.split("-").map(Number);
  let ref = new Date(y, m - 1, d);
  if (Number.isNaN(ref.getTime())) ref = today;
  if (ref > today) ref = today;

  let from = ref;
  let to = ref;
  if (params.period === "mes") {
    from = startOfMonth(ref);
    to = addDays(startOfMonth(addMonths(ref, 1)), -1);
  } else if (params.period === "ano") {
    from = new Date(ref.getFullYear(), 0, 1);
    to = new Date(ref.getFullYear(), 11, 31);
  }

  const isDay = params.period === "dia";
  const [stats, dayProgress] = await Promise.all([
    computeCompliancePeriodStats(from, to),
    isDay ? computeDayProgress(ref) : Promise.resolve(null),
  ]);

  return {
    period: params.period,
    refKey: localDateKey(ref),
    fromKey: localDateKey(from),
    toKey: localDateKey(to),
    /** Dia ainda não fechado (hoje): só andamento, sem % de aderência. */
    isOpenDay: isDay && ref > closedDay,
    /** Mês/ano corrente: a conta para em ontem. */
    cappedAtYesterday: !isDay && to > closedDay,
    stats,
    dayProgress,
    canJustify: canJustifyChecklist(user),
  };
}

export type CoverageGaps = {
  /** Cobrados por checklist, mas a cobrança não consegue funcionar pra eles. */
  unconfigured: { id: string; name: string; functionName: string | null; reason: string }[];
  /** Funções com gente ativa que NÃO é cobrada por nenhum checklist (ADM/liderança fora). */
  uncovered: { functionName: string; count: number }[];
};

/**
 * Onde a cobrança de checklist tem buraco: (1) quem é cobrado mas não tem checklist configurado (área sem checklist, ou sem
 * escala) — a % ignora essas pessoas, então elas somem do indicador sem ninguém notar; (2) funções inteiras com gente ativa
 * que nunca é cobrada (ex: ninguém marcou "Precisa de checklist" nem configurou a função).
 */
export async function getChecklistCoverageGaps(user: CurrentUser): Promise<CoverageGaps> {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const [all, requiredByArea] = await Promise.all([
    db.collaborator.findMany({ where: { active: true }, include: collaboratorWithFunctionInclude, orderBy: { name: "asc" } }),
    getRequiredEquipmentByArea(),
  ]);

  const unconfigured: CoverageGaps["unconfigured"] = [];
  const uncovered = new Map<string, number>();
  for (const c of all) {
    const charged = c.checklistEnabled || c.requiresChecklist || (c.function?.requiredChecklists.length ?? 0) > 0;
    if (charged) {
      const { items } = getRequiredItemsForCollaborator(c, requiredByArea);
      if (items.length === 0) {
        unconfigured.push({
          id: c.id,
          name: c.name,
          functionName: c.function?.name ?? null,
          reason: "não existe checklist configurado para a área ou a função dele",
        });
      }
    } else if (!c.function?.dtoExempt) {
      const key = c.function?.name ?? "(sem função)";
      uncovered.set(key, (uncovered.get(key) ?? 0) + 1);
    }
  }
  return {
    unconfigured,
    uncovered: [...uncovered.entries()].map(([functionName, count]) => ({ functionName, count })).sort((a, b) => b.count - a.count),
  };
}


export type ChecklistNonCompletion = {
  collaboratorId: string;
  name: string;
  areaName: string | null;
  dayKey: string;
  required: number;
  done: number;
};

export type ChecklistDayResultRow = ChecklistNonCompletion;

/**
 * Resultado de cada dia FECHADO em que quem é cobrado por checklist estava escalado e tinha equipamento exigido (feitos x exigidos). Não entram: equipamento
 * que estava bloqueado/em manutenção no dia (não era exigido), item justificado com motivo que conta como cumprido (vale como feito) e quem ainda não tem
 * login (não tem como fazer). `skip` = "colaborador|dia" já travados, que não são recalculados.
 */
async function computeChecklistDayResults(fromKey: string, skip: Set<string> = new Set()): Promise<ChecklistDayResultRow[]> {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const rangeStart = new Date(fy, fm - 1, fd);
  const rangeEndExclusive = addDays(lastClosedDay(), 1);
  if (rangeStart >= rangeEndExclusive) return [];

  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea({ includeUnavailable: true }),
  ]);
  const unavailable = await loadUnavailability(localDateKey(addDays(rangeEndExclusive, -1)));
  const eligible = collaborators.filter((c) => c.userId && getRequiredItemsForCollaborator(c, requiredByArea).items.length > 0);
  if (eligible.length === 0) return [];

  const executions = await db.checklistExecution.findMany({
    where: {
      executedById: { in: eligible.map((c) => c.userId!) },
      status: "CONCLUIDO",
      finishedAt: { gte: dayStartInstant(rangeStart), lt: dayStartInstant(rangeEndExclusive) },
    },
    select: { executedById: true, equipmentId: true, finishedAt: true, checklistVersion: { select: { templateId: true } } },
  });
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

  const result: ChecklistDayResultRow[] = [];
  for (const c of eligible) {
    const required = getRequiredItemsForCollaborator(c, requiredByArea).items;
    for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
      const dayKey = localDateKey(date);
      if (skip.has(`${c.id}|${dayKey}`)) continue;
      const note = notesByKey.get(`${c.id}|${dayKey}`);
      if ((note ? note.overrideStatus : dayStatusFor(date, c)) !== "TRABALHO") continue;
      const effective = required.filter((e) => !unavailable(e.id, dayKey));
      if (effective.length === 0) continue;
      const completedIds = new Set([
        ...(completedByKey.get(`${c.userId}|${dayKey}`) ?? []),
        ...justifiedItemIds(justificationsByKey.get(`${c.id}|${dayKey}`)),
      ]);
      result.push({ collaboratorId: c.id, name: c.name, areaName: c.area?.name ?? null, dayKey, required: effective.length, done: effective.filter((e) => completedIds.has(e.id)).length });
    }
  }
  return result;
}

/** Dias já travados a partir de `fromKey`. Tolerante: sem a tabela, nada está travado e vale o cálculo na hora. */
async function loadFrozenDays(fromKey: string): Promise<ChecklistDayResultRow[]> {
  try {
    const rows = await db.checklistDayResult.findMany({ where: { dayKey: { gte: fromKey } } });
    return rows.map((r) => ({ collaboratorId: r.collaboratorId, name: r.collaboratorName, areaName: r.areaName, dayKey: r.dayKey, required: r.required, done: r.done }));
  } catch (error) {
    console.error("[checklist-compliance] dias travados indisponíveis:", error);
    return [];
  }
}

/**
 * Dias FECHADOS (de `fromKey` até ontem) em que a pessoa fez MENOS de 80% dos equipamentos exigidos: a base das medidas disciplinares. Dia travado vale
 * como foi travado (mudar o cadastro depois não cria nem apaga ocorrência de dia passado); dia ainda não travado é calculado com o cadastro de agora.
 */
export async function listChecklistNonCompletion(fromKey: string): Promise<ChecklistNonCompletion[]> {
  const frozen = await loadFrozenDays(fromKey);
  const live = await computeChecklistDayResults(fromKey, new Set(frozen.map((f) => `${f.collaboratorId}|${f.dayKey}`)));
  return [...frozen, ...live].filter((r) => isChecklistInfraction({ required: r.required, doneOrJustified: r.done }));
}

/** Trava o resultado dos dias fechados ainda não travados, de `fromKey` até ontem. Devolve quantos dias-pessoa foram travados. */
export async function freezeChecklistDays(fromKey: string): Promise<number> {
  const frozen = await loadFrozenDays(fromKey);
  const live = await computeChecklistDayResults(fromKey, new Set(frozen.map((f) => `${f.collaboratorId}|${f.dayKey}`)));
  if (live.length === 0) return 0;
  const saved = await db.checklistDayResult.createMany({
    skipDuplicates: true,
    data: live.map((r) => ({ collaboratorId: r.collaboratorId, dayKey: r.dayKey, collaboratorName: r.name, areaName: r.areaName, required: r.required, done: r.done })),
  });
  return saved.count;
}

/**
 * Refaz o resultado travado de UMA pessoa com o cadastro de agora, de `fromKey` até ontem: apaga os dias travados dela e trava de novo o que o cálculo atual
 * dá. Serve quando o cadastro estava errado (ex.: a função não tinha o checklist obrigatório e a pessoa foi cobrada de todos os equipamentos da área) e os
 * dias já tinham sido travados com a exigência errada. As decisões já tomadas (medida aplicada ou dispensada) não são mexidas. Devolve quantos dias-pessoa
 * tinham ocorrência antes e quantos têm agora.
 */
export async function recomputeChecklistDaysForCollaborator(collaboratorId: string, fromKey: string): Promise<{ before: number; after: number }> {
  const countInfractions = (rows: ChecklistDayResultRow[]) => rows.filter((r) => r.collaboratorId === collaboratorId && isChecklistInfraction({ required: r.required, doneOrJustified: r.done })).length;
  const before = countInfractions(await listChecklistNonCompletion(fromKey));
  try {
    await db.checklistDayResult.deleteMany({ where: { collaboratorId, dayKey: { gte: fromKey } } });
  } catch (error) {
    console.error("[checklist-compliance] sem a tabela de dias travados:", error);
  }
  const live = (await computeChecklistDayResults(fromKey, new Set())).filter((r) => r.collaboratorId === collaboratorId);
  try {
    if (live.length > 0) {
      await db.checklistDayResult.createMany({
        skipDuplicates: true,
        data: live.map((r) => ({ collaboratorId: r.collaboratorId, dayKey: r.dayKey, collaboratorName: r.name, areaName: r.areaName, required: r.required, done: r.done })),
      });
    }
  } catch (error) {
    console.error("[checklist-compliance] não foi possível travar de novo:", error);
  }
  return { before, after: countInfractions(live) };
}

/** Ontem (calendário de Brasília), AAAA-MM-DD: o dia que a rotina diária trava. */
export function yesterdayKey(): string {
  return localDateKey(lastClosedDay());
}
