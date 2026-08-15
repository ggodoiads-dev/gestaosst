import "server-only";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

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

function listEligibleCollaboratorsQuery() {
  return db.collaborator.findMany({
    where: { active: true, checklistEnabled: true, userId: { not: null } },
    include: { turno: { include: { scheduleType: true } }, area: true },
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
      include: { turno: { include: { scheduleType: true } }, area: true },
    }),
    db.scheduleDayNote.findMany({ where: { collaboratorId, date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea(),
  ]);

  const required = collaborator.areaId ? (requiredByArea.get(collaborator.areaId) ?? []) : [];
  const requiredIds = required.map((e) => e.id);

  const executions =
    collaborator.userId && requiredIds.length > 0
      ? await db.checklistExecution.findMany({
          where: {
            executedById: collaborator.userId,
            equipmentId: { in: requiredIds },
            status: "CONCLUIDO",
            finishedAt: { gte: rangeStart, lt: rangeEndExclusive },
          },
          select: { equipmentId: true, finishedAt: true },
        })
      : [];

  const completedByDay = new Map<string, Set<string>>();
  for (const ex of executions) {
    const key = localDateKey(ex.finishedAt!);
    const set = completedByDay.get(key) ?? new Set<string>();
    set.add(ex.equipmentId);
    completedByDay.set(key, set);
  }

  const notesByKey = new Map(notes.map((n) => [localDateKey(n.date), n]));
  const today = startOfDay(new Date());

  const days = [];
  for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
    const key = localDateKey(date);
    const note = notesByKey.get(key) ?? null;
    const computed = getCollaboratorDayStatus(date, collaborator);
    const status = note ? note.overrideStatus : computed;
    const completedIds = completedByDay.get(key) ?? new Set<string>();
    days.push({
      date,
      status,
      future: date > today,
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
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
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
  collaboratorsIncomplete: { id: string; name: string; pendingCount: number }[];
};

async function computeCompliancePeriodStats(from: Date, toInclusive: Date): Promise<PeriodComplianceStats> {
  const rangeStart = startOfDay(from);
  const today = startOfDay(new Date());
  // Nunca conta turnos futuros como pendência — só o que já aconteceu (ou está acontecendo hoje).
  const rangeEndExclusive = addDays(startOfDay(toInclusive) < today ? startOfDay(toInclusive) : today, 1);
  if (rangeStart >= rangeEndExclusive) {
    return { collaboratorsScheduled: 0, collaboratorsComplete: 0, collaboratorsIncomplete: [] };
  }

  const [collaborators, notes, requiredByArea] = await Promise.all([
    listEligibleCollaboratorsQuery(),
    db.scheduleDayNote.findMany({ where: { date: { gte: rangeStart, lt: rangeEndExclusive } } }),
    getRequiredEquipmentByArea(),
  ]);

  const eligible = collaborators.filter((c) => c.areaId && c.userId && (requiredByArea.get(c.areaId)?.length ?? 0) > 0);
  const userIds = eligible.map((c) => c.userId!);

  const executions =
    userIds.length > 0
      ? await db.checklistExecution.findMany({
          where: { executedById: { in: userIds }, status: "CONCLUIDO", finishedAt: { gte: rangeStart, lt: rangeEndExclusive } },
          select: { executedById: true, equipmentId: true, finishedAt: true },
        })
      : [];

  const completedByKey = new Map<string, Set<string>>();
  for (const ex of executions) {
    const key = `${ex.executedById}|${localDateKey(ex.finishedAt!)}`;
    const set = completedByKey.get(key) ?? new Set<string>();
    set.add(ex.equipmentId);
    completedByKey.set(key, set);
  }

  const notesByKey = new Map(notes.map((n) => [`${n.collaboratorId}|${localDateKey(n.date)}`, n]));

  let scheduledCount = 0;
  const incomplete: PeriodComplianceStats["collaboratorsIncomplete"] = [];

  for (const c of eligible) {
    const required = requiredByArea.get(c.areaId!) ?? [];
    let scheduledAnyDay = false;
    let pendingTotal = 0;

    for (let date = rangeStart; date < rangeEndExclusive; date = addDays(date, 1)) {
      const dayKey = localDateKey(date);
      const note = notesByKey.get(`${c.id}|${dayKey}`);
      const computed = getCollaboratorDayStatus(date, c);
      const status = note ? note.overrideStatus : computed;
      if (status !== "TRABALHO") continue;
      scheduledAnyDay = true;
      const completedIds = completedByKey.get(`${c.userId}|${dayKey}`) ?? new Set<string>();
      pendingTotal += required.filter((e) => !completedIds.has(e.id)).length;
    }

    if (!scheduledAnyDay) continue;
    scheduledCount++;
    if (pendingTotal > 0) incomplete.push({ id: c.id, name: c.name, pendingCount: pendingTotal });
  }

  return {
    collaboratorsScheduled: scheduledCount,
    collaboratorsComplete: scheduledCount - incomplete.length,
    collaboratorsIncomplete: incomplete,
  };
}

/** Visão geral (hoje + mês corrente) de quantos colaboradores com checklist obrigatório
 * cumpriram tudo vs. ficaram com pendência — base do dashboard de conformidade de checklist. */
export async function getChecklistComplianceDashboard(user: CurrentUser, params: { date?: Date } = {}) {
  requirePermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const date = params.date ?? new Date();
  const dayStart = startOfDay(date);
  const monthStart = startOfMonth(date);
  const monthEndInclusive = addDays(startOfMonth(addMonths(date, 1)), -1);

  const [today, month] = await Promise.all([
    computeCompliancePeriodStats(dayStart, dayStart),
    computeCompliancePeriodStats(monthStart, monthEndInclusive),
  ]);

  return { date: dayStart, today, month };
}
