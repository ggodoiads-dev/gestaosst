import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { AccidentType, AccidentStatus, AccidentActionStatus, SifClassification } from "@/generated/prisma/enums";
import type { Criticality } from "@/generated/prisma/enums";

export type AccidentInput = {
  date: Date;
  time?: string | null;
  areaId?: string | null;
  type: AccidentType;
  severity: Criticality;
  description: string;
  immediateCause?: string | null;
  rootCause?: string | null;
  isSif: boolean;
  sifClassification?: SifClassification | null;
  creditNumber?: string | null;
  involvedCollaboratorIds: string[];
  witnessCollaboratorIds: string[];
  /** Só usado pela importação em lote de registros históricos — cadastro manual sempre abre "ABERTO". */
  status?: AccidentStatus;
  closedAt?: Date | null;
};

/** Sem filtro, esconde os cancelados por padrão (soft-delete "some da aba", não fica só com uma
 * etiqueta na lista) — passe status: "CANCELADA" pra ver só os cancelados, ou "ALL" pra ver tudo. */
export function listAccidentsForUser(user: CurrentUser, filters: { status?: AccidentStatus | "ALL" } = {}) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const where = filters.status === "ALL" ? {} : filters.status ? { status: filters.status } : { status: { not: "CANCELADA" as const } };
  return db.accident.findMany({
    where,
    include: { area: true, involvements: { include: { collaborator: true } } },
    orderBy: { date: "desc" },
  });
}

export async function getAccidentDetail(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  return db.accident.findUniqueOrThrow({
    where: { id },
    include: {
      area: true,
      investigatedBy: true,
      reportedBy: true,
      involvements: { include: { collaborator: true } },
      actions: { include: { responsibleUser: true, responsibleCollaborator: true }, orderBy: { dueDate: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
    },
  });
}

export async function createAccident(user: CurrentUser, data: AccidentInput) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  const accident = await db.$transaction(async (tx) => {
    const code = await nextFriendlyCode("accident", "ACID", 6, tx);
    const created = await tx.accident.create({
      data: {
        code,
        date: data.date,
        time: data.time,
        areaId: data.areaId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        immediateCause: data.immediateCause,
        rootCause: data.rootCause,
        isSif: data.isSif,
        sifClassification: data.isSif ? data.sifClassification : null,
        creditNumber: data.creditNumber,
        reportedById: user.id,
        status: data.status ?? "ABERTO",
        investigatedById: data.status && data.status !== "ABERTO" ? user.id : null,
        closedAt: data.status === "CONCLUIDO" ? (data.closedAt ?? data.date) : null,
      },
    });

    for (const collaboratorId of data.involvedCollaboratorIds) {
      await tx.accidentInvolvement.create({
        data: { accidentId: created.id, collaboratorId, role: "VITIMA" },
      });
    }
    for (const collaboratorId of data.witnessCollaboratorIds) {
      await tx.accidentInvolvement.create({
        data: { accidentId: created.id, collaboratorId, role: "TESTEMUNHA" },
      });
    }

    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Accident", entityId: created.id, newValue: data },
      tx,
    );

    return created;
  });

  return accident;
}

export async function updateAccident(user: CurrentUser, id: string, data: AccidentInput) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const before = await db.accident.findUniqueOrThrow({ where: { id } });

  const accident = await db.$transaction(async (tx) => {
    const updated = await tx.accident.update({
      where: { id },
      data: {
        date: data.date,
        time: data.time,
        areaId: data.areaId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        immediateCause: data.immediateCause,
        rootCause: data.rootCause,
        isSif: data.isSif,
        sifClassification: data.isSif ? data.sifClassification : null,
        creditNumber: data.creditNumber,
      },
    });

    // Recria os envolvimentos do zero — mais simples e seguro que tentar calcular o diff, já que
    // um acidente raramente tem mais que uma dezena de envolvidos.
    await tx.accidentInvolvement.deleteMany({ where: { accidentId: id } });
    for (const collaboratorId of data.involvedCollaboratorIds) {
      await tx.accidentInvolvement.create({ data: { accidentId: id, collaboratorId, role: "VITIMA" } });
    }
    for (const collaboratorId of data.witnessCollaboratorIds) {
      await tx.accidentInvolvement.create({ data: { accidentId: id, collaboratorId, role: "TESTEMUNHA" } });
    }

    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "Accident", entityId: id, previousValue: before, newValue: data },
      tx,
    );

    return updated;
  });

  return accident;
}

export async function updateAccidentStatus(user: CurrentUser, id: string, status: AccidentStatus) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const before = await db.accident.findUniqueOrThrow({ where: { id } });

  const accident = await db.$transaction(async (tx) => {
    const updated = await tx.accident.update({
      where: { id },
      data: {
        status,
        investigatedById: status === "EM_INVESTIGACAO" && !before.investigatedById ? user.id : before.investigatedById,
        closedAt: status === "CONCLUIDO" ? new Date() : before.closedAt,
      },
    });
    await recordAudit(
      {
        userId: user.id,
        action: "STATUS_CHANGE",
        entityType: "Accident",
        entityId: id,
        previousValue: { status: before.status },
        newValue: { status },
      },
      tx,
    );
    return updated;
  });

  return accident;
}

/** Anexa uma evidência ao acidente (foto, PDF, apresentação de investigação, etc.) — sempre
 * adiciona, nunca substitui, já que um acidente costuma acumular várias evidências ao longo
 * da investigação. */
export async function attachAccidentFile(
  user: CurrentUser,
  accidentId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  await db.accident.findUniqueOrThrow({ where: { id: accidentId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "ACIDENTE",
      accidentId,
      uploadedById: user.id,
    },
  });
}

export type AccidentActionInput = {
  description: string;
  responsibleUserId?: string | null;
  responsibleCollaboratorId?: string | null;
  dueDate: Date;
};

export async function createAccidentAction(user: CurrentUser, accidentId: string, data: AccidentActionInput) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  await db.accident.findUniqueOrThrow({ where: { id: accidentId } });

  const action = await db.$transaction(async (tx) => {
    const created = await tx.accidentAction.create({
      data: {
        accidentId,
        description: data.description,
        responsibleUserId: data.responsibleUserId,
        responsibleCollaboratorId: data.responsibleCollaboratorId,
        dueDate: data.dueDate,
      },
    });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "AccidentAction", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return action;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ACCIDENT_TYPE_LABELS: Record<AccidentType, string> = {
  ACIDENTE_TIPICO: "Acidente típico",
  ACIDENTE_TRAJETO: "Acidente de trajeto",
  QUASE_ACIDENTE: "Quase acidente",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
  FAI: "FAI",
};

export type AccidentMonthlyStats = {
  year: number;
  monthly: { month: number; label: string; count: number }[];
  byType: { type: AccidentType; label: string; count: number }[];
  totalCount: number;
  topType: { type: AccidentType; label: string; count: number } | null;
  /** Descrição em texto livre de cada ocorrência — o campo "tipo" estruturado é amplo demais
   * (ex: tudo cai em ACIDENTE_TIPICO); o padrão real de reincidência (ex: "queda de bulks",
   * "prensamento de mão") normalmente só aparece lendo a descrição. */
  descriptions: string[];
};

/** Painel mensal de acidentes/incidentes do ano — usado no dashboard da tela de Acidentes.
 * Cancelados não entram na contagem (registro de teste/duplicado não deveria distorcer a série). */
export async function getAccidentMonthlyStats(user: CurrentUser, year?: number): Promise<AccidentMonthlyStats> {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const targetYear = year ?? new Date().getFullYear();
  const from = new Date(targetYear, 0, 1);
  const to = new Date(targetYear, 11, 31, 23, 59, 59);

  const accidents = await db.accident.findMany({
    where: { date: { gte: from, lte: to }, status: { not: "CANCELADA" } },
    select: { date: true, type: true, description: true },
  });

  const monthCounts = Array<number>(12).fill(0);
  const typeCounts = new Map<AccidentType, number>();
  for (const a of accidents) {
    monthCounts[a.date.getMonth()]!++;
    typeCounts.set(a.type, (typeCounts.get(a.type) ?? 0) + 1);
  }

  const byType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, label: ACCIDENT_TYPE_LABELS[type], count }))
    .sort((a, b) => b.count - a.count);

  return {
    year: targetYear,
    monthly: MONTH_LABELS.map((label, i) => ({ month: i + 1, label, count: monthCounts[i]! })),
    byType,
    totalCount: accidents.length,
    topType: byType[0] ?? null,
    descriptions: accidents.map((a) => a.description).slice(0, 100),
  };
}

export async function setAccidentActionStatus(user: CurrentUser, actionId: string, status: AccidentActionStatus) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const before = await db.accidentAction.findUniqueOrThrow({ where: { id: actionId } });

  const action = await db.accidentAction.update({
    where: { id: actionId },
    data: { status, completedAt: status === "CONCLUIDA" ? new Date() : before.completedAt },
  });
  await recordAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entityType: "AccidentAction",
    entityId: actionId,
    previousValue: { status: before.status },
    newValue: { status },
  });
  return action;
}
