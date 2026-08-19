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

export function listAccidentsForUser(user: CurrentUser, filters: { status?: string } = {}) {
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  return db.accident.findMany({
    where: { status: (filters.status as AccidentStatus) || undefined },
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
