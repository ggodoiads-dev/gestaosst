import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { stepHasDocument } from "@/domain/discipline/document";
import { listChecklistNonCompletion } from "@/server/services/checklist-compliance.service";
import {
  DISCIPLINE_START_KEY,
  DISCIPLINE_REASONS,
  DISCIPLINE_STEPS,
  nextDisciplineStep,
  type DisciplineReasonKey,
  type DisciplineStepKey,
} from "@/domain/discipline/ladder";

/**
 * Medidas disciplinares por motivo. A ocorrência é derivada (checklist sem nenhum equipamento feito; falta lançada sem
 * advertência) e o RH/gestor decide: aplicar uma medida da escada ou dispensar com justificativa. A medida sugerida é a
 * próxima da escada daquele motivo (conta só as já APLICADAS), mas quem confirma pode escolher outra.
 */

export function canManageDiscipline(user: CurrentUser): boolean {
  return hasPermission(user, PERMISSIONS.HR_MANAGE) || hasPermission(user, PERMISSIONS.DISCIPLINE_MANAGE);
}

function requireDiscipline(user: CurrentUser) {
  if (!canManageDiscipline(user)) throw new ForbiddenError();
}

export type DisciplineItem = {
  reason: DisciplineReasonKey;
  collaboratorId: string;
  collaboratorName: string;
  areaName: string | null;
  dayKey: string;
  /** Só falta: a observação do dia (pra marcar a advertência como tratada junto). */
  noteId: string | null;
  suggestedStep: DisciplineStepKey;
  appliedCount: number;
  /** Só checklist parcial: quantos equipamentos fez / eram exigidos. */
  done?: number;
  required?: number;
};

export type DisciplineHistoryEntry = {
  id: string;
  reason: DisciplineReasonKey;
  collaboratorName: string;
  dayKey: string;
  step: string;
  status: "APLICADA" | "DISPENSADA";
  hasDocument: boolean;
  note: string | null;
  decidedByName: string;
  decidedAt: Date;
};

const dayKeyOf = (date: Date) => date.toISOString().slice(0, 10);
const noonOf = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`);

async function loadMeasures() {
  try {
    return await db.disciplinaryMeasure.findMany({
      orderBy: { decidedAt: "desc" },
      include: { collaborator: { select: { name: true } }, decidedBy: { select: { name: true } } },
    });
  } catch (error) {
    console.error("[discipline] tabela de medidas indisponível:", error);
    return [];
  }
}

/** Ocorrências ainda sem decisão + o que já foi decidido (últimos 60 registros). */
export async function getDisciplineOverview(user: CurrentUser) {
  requireDiscipline(user);
  const measures = await loadMeasures();
  const applied = new Map<string, number>();
  const handled = new Set<string>();
  for (const m of measures) {
    const dayKey = dayKeyOf(m.referenceDate);
    handled.add(`${m.reason}|${m.collaboratorId}|${dayKey}`);
    if (m.status === "APLICADA") applied.set(`${m.reason}|${m.collaboratorId}`, (applied.get(`${m.reason}|${m.collaboratorId}`) ?? 0) + 1);
  }

  const [checklistDays, faltas] = await Promise.all([
    listChecklistNonCompletion(DISCIPLINE_START_KEY),
    db.scheduleDayNote.findMany({
      where: { status: "FALTA", warningApplied: false, date: { gte: new Date(`${DISCIPLINE_START_KEY}T00:00:00Z`) } },
      include: { collaborator: { select: { id: true, name: true, area: { select: { name: true } } } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const raw: Omit<DisciplineItem, "suggestedStep" | "appliedCount">[] = [
    ...checklistDays
      .filter((d) => !d.partial)
      .map((d) => ({
      reason: "CHECKLIST" as const,
      collaboratorId: d.collaboratorId,
      collaboratorName: d.name,
      areaName: d.areaName,
      dayKey: d.dayKey,
      noteId: null,
    })),
    ...faltas.map((n) => ({
      reason: "FALTA" as const,
      collaboratorId: n.collaboratorId,
      collaboratorName: n.collaborator.name,
      areaName: n.collaborator.area?.name ?? null,
      dayKey: dayKeyOf(n.date),
      noteId: n.id,
    })),
  ]
    .filter((i) => !handled.has(`${i.reason}|${i.collaboratorId}|${i.dayKey}`))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  // Em ordem cronológica, cada ocorrência pendente sobe um degrau da escada daquele motivo.
  const position = new Map<string, number>();
  const items: DisciplineItem[] = raw.map((i) => {
    const key = `${i.reason}|${i.collaboratorId}`;
    const index = position.get(key) ?? 0;
    position.set(key, index + 1);
    const appliedCount = applied.get(key) ?? 0;
    return { ...i, appliedCount, suggestedStep: nextDisciplineStep(appliedCount + index) };
  });

  // Fez só uma parte (menos da metade): não entra na escada sozinho, mas aparece pro RH aplicar a medida se quiser.
  const partial: DisciplineItem[] = checklistDays
    .filter((d) => d.partial && !handled.has(`CHECKLIST|${d.collaboratorId}|${d.dayKey}`))
    .map((d) => {
      const appliedCount = applied.get(`CHECKLIST|${d.collaboratorId}`) ?? 0;
      return {
        reason: "CHECKLIST" as const,
        collaboratorId: d.collaboratorId,
        collaboratorName: d.name,
        areaName: d.areaName,
        dayKey: d.dayKey,
        noteId: null,
        appliedCount,
        suggestedStep: nextDisciplineStep(appliedCount),
        done: d.done,
        required: d.required,
      };
    })
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  const history: DisciplineHistoryEntry[] = measures.slice(0, 60).map((m) => ({
    id: m.id,
    reason: m.reason as DisciplineReasonKey,
    collaboratorName: m.collaborator.name,
    dayKey: dayKeyOf(m.referenceDate),
    step: m.step,
    status: m.status as "APLICADA" | "DISPENSADA",
    hasDocument: m.status === "APLICADA" && stepHasDocument(m.step),
    note: m.note,
    decidedByName: m.decidedBy.name,
    decidedAt: m.decidedAt,
  }));
  return { items, partial, history };
}

export type DecideInput = {
  reason: DisciplineReasonKey;
  collaboratorId: string;
  dayKey: string;
  step: DisciplineStepKey;
  note: string;
};

async function decide(user: CurrentUser, input: DecideInput, status: "APLICADA" | "DISPENSADA") {
  requireDiscipline(user);
  if (!DISCIPLINE_REASONS.some((r) => r.key === input.reason)) throw new Error("Motivo inválido.");
  if (!DISCIPLINE_STEPS.some((s) => s.key === input.step)) throw new Error("Medida inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) throw new Error("Data inválida.");
  const note = input.note.trim();
  if (status === "DISPENSADA" && note.length < 3) throw new Error("Escreva o motivo da justificativa.");

  const referenceDate = noonOf(input.dayKey);
  const existing = await db.disciplinaryMeasure.findUnique({
    where: { collaboratorId_reason_referenceDate: { collaboratorId: input.collaboratorId, reason: input.reason, referenceDate } },
  });
  if (existing) throw new Error("Essa ocorrência já foi tratada.");

  const created = await db.disciplinaryMeasure.create({
    data: {
      collaboratorId: input.collaboratorId,
      reason: input.reason,
      referenceDate,
      step: input.step,
      status,
      note: note || null,
      decidedById: user.id,
    },
  });
  // Falta: tratar a medida também tira a falta da fila de advertência (mesmo marcador que já existia).
  if (input.reason === "FALTA") {
    const next = noonOf(input.dayKey);
    await db.scheduleDayNote.updateMany({
      where: { collaboratorId: input.collaboratorId, status: "FALTA", date: { gte: new Date(`${input.dayKey}T00:00:00Z`), lt: new Date(next.getTime() + 12 * 3600 * 1000) } },
      data: { warningApplied: true },
    });
  }
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "DisciplinaryMeasure",
    entityId: created.id,
    newValue: { ...input, status },
  });
  return created;
}

export const applyMeasure = (user: CurrentUser, input: DecideInput) => decide(user, input, "APLICADA");
export const dismissOccurrence = (user: CurrentUser, input: DecideInput) => decide(user, input, "DISPENSADA");

/** Dados pro documento impresso de uma medida aplicada (com a posição dela na escada daquele motivo). */
export async function getMeasureForDocument(user: CurrentUser, id: string) {
  requireDiscipline(user);
  const measure = await db.disciplinaryMeasure.findUnique({
    where: { id },
    include: {
      collaborator: { select: { name: true, matricula: true, function: { select: { name: true } }, area: { select: { name: true } } } },
    },
  });
  if (!measure || measure.status !== "APLICADA") return null;
  const sequence = await db.disciplinaryMeasure.count({
    where: { collaboratorId: measure.collaboratorId, reason: measure.reason, status: "APLICADA", decidedAt: { lte: measure.decidedAt } },
  });
  return { measure, sequence };
}
