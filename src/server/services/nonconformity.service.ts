import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordEquipmentEvent } from "@/server/services/equipment-events";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { NonconformityStatus } from "@/generated/prisma/enums";

export function listNonconformitiesForUser(
  user: CurrentUser,
  filters: { status?: string; severity?: string; areaId?: string; overdue?: boolean } = {},
) {
  const canSeeAll = user.permissions.has(PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS);

  return db.nonconformity.findMany({
    where: {
      areaId: canSeeAll ? filters.areaId : { in: filters.areaId ? [filters.areaId] : Array.from(user.areaIds) },
      status: filters.overdue
        ? { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] }
        : (filters.status as never) || undefined,
      severity: (filters.severity as never) || undefined,
      dueDate: filters.overdue ? { lt: new Date() } : undefined,
    },
    include: { equipment: true, area: true, responsible: true, actionPlan: { include: { items: true } } },
    orderBy: { identifiedAt: "desc" },
  });
}

export async function getNonconformityDetail(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.NONCONFORMITY_VIEW);
  return db.nonconformity.findUniqueOrThrow({
    where: { id },
    include: {
      equipment: true,
      area: true,
      identifiedBy: true,
      responsible: true,
      faultCategory: true,
      originExecution: true,
      originAnswer: { include: { question: true, attachments: true } },
      actionPlan: {
        include: {
          items: {
            include: { responsible: true, completedBy: true, validatedBy: true, attachments: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

export function listActionItemsForUser(
  user: CurrentUser,
  filters: { status?: string; overdue?: boolean } = {},
) {
  const canSeeAll = user.permissions.has(PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS);

  return db.actionItem.findMany({
    where: {
      status: filters.overdue ? { in: ["PENDENTE", "EM_ANDAMENTO"] } : (filters.status as never) || undefined,
      dueDate: filters.overdue ? { lt: new Date() } : undefined,
      actionPlan: {
        nonconformity: {
          areaId: canSeeAll ? undefined : { in: Array.from(user.areaIds) },
        },
      },
    },
    include: {
      responsible: true,
      actionPlan: { include: { nonconformity: { include: { equipment: true, area: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function assignNonconformityResponsible(
  user: CurrentUser,
  id: string,
  responsibleId: string,
  dueDate: Date | null,
) {
  requirePermission(user, PERMISSIONS.NONCONFORMITY_TREAT);
  const nc = await db.nonconformity.update({ where: { id }, data: { responsibleId, dueDate } });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Nonconformity",
    entityId: id,
    newValue: { responsibleId, dueDate },
  });
  return nc;
}

export type ActionItemInput = {
  description: string;
  responsibleId: string;
  dueDate: Date;
  priority: "BAIXA" | "MEDIA" | "ALTA";
};

export async function createActionItem(user: CurrentUser, nonconformityId: string, data: ActionItemInput) {
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);

  const nc = await db.nonconformity.findUniqueOrThrow({
    where: { id: nonconformityId },
    include: { actionPlan: true },
  });
  if (["CONCLUIDA", "ENCERRADA", "CANCELADA"].includes(nc.status)) {
    throw new ForbiddenError("Esta não conformidade já está encerrada.");
  }

  const actionPlan =
    nc.actionPlan ?? (await db.actionPlan.create({ data: { nonconformityId, createdById: user.id } }));

  const item = await db.$transaction(async (tx) => {
    const created = await tx.actionItem.create({
      data: {
        actionPlanId: actionPlan.id,
        description: data.description,
        responsibleId: data.responsibleId,
        dueDate: data.dueDate,
        priority: data.priority,
      },
    });

    if (nc.status === "ABERTA" || nc.status === "EM_ANALISE") {
      await tx.nonconformity.update({ where: { id: nonconformityId }, data: { status: "ACAO_DEFINIDA" } });
    }

    await recordEquipmentEvent(
      {
        equipmentId: nc.equipmentId,
        type: "ACAO_CRIADA",
        description: `Ação criada para a não conformidade ${nc.code}.`,
        userId: user.id,
        nonconformityId,
        actionItemId: created.id,
      },
      tx,
    );
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "ActionItem", entityId: created.id, newValue: data },
      tx,
    );

    return created;
  });

  return item;
}

export async function completeActionItem(user: CurrentUser, actionItemId: string, notes: string | null) {
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);

  const item = await db.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    include: { actionPlan: { include: { nonconformity: true, items: true } } },
  });

  await db.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: actionItemId },
      data: { status: "CONCLUIDA", notes, completedAt: new Date(), completedById: user.id },
    });

    const nc = item.actionPlan.nonconformity;
    await tx.nonconformity.update({ where: { id: nc.id }, data: { status: "AGUARDANDO_VERIFICACAO" } });

    await recordEquipmentEvent(
      {
        equipmentId: nc.equipmentId,
        type: "ACAO_CONCLUIDA",
        description: "Ação concluída, aguardando validação.",
        userId: user.id,
        nonconformityId: nc.id,
        actionItemId,
      },
      tx,
    );
    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "ActionItem", entityId: actionItemId, newValue: { status: "CONCLUIDA" } },
      tx,
    );
  });
}

/**
 * Valida a correção de uma ação e, quando não restar nenhuma outra não
 * conformidade em aberto que justifique o status atual do equipamento,
 * libera o equipamento automaticamente (seções 35-36 do documento).
 */
export async function validateActionItem(user: CurrentUser, actionItemId: string) {
  requirePermission(user, PERMISSIONS.ACTIONITEM_VALIDATE);

  const item = await db.actionItem.findUniqueOrThrow({
    where: { id: actionItemId },
    include: { actionPlan: { include: { nonconformity: { include: { equipment: true } } } } },
  });

  if (item.status !== "CONCLUIDA") {
    throw new ForbiddenError("A ação precisa estar concluída antes de ser validada.");
  }

  const nc = item.actionPlan.nonconformity;

  await db.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: actionItemId },
      data: { validatedAt: new Date(), validatedById: user.id },
    });

    await tx.nonconformity.update({ where: { id: nc.id }, data: { status: "ENCERRADA" } });

    await recordEquipmentEvent(
      {
        equipmentId: nc.equipmentId,
        type: "CORRECAO_VALIDADA",
        description: `Correção da não conformidade ${nc.code} validada.`,
        userId: user.id,
        nonconformityId: nc.id,
        actionItemId,
      },
      tx,
    );

    const otherOpenSevereNc = await tx.nonconformity.count({
      where: {
        equipmentId: nc.equipmentId,
        id: { not: nc.id },
        status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] },
      },
    });

    if (otherOpenSevereNc === 0 && nc.equipment.status !== "LIBERADO") {
      const previousStatus = nc.equipment.status;
      await tx.equipment.update({ where: { id: nc.equipmentId }, data: { status: "LIBERADO" } });
      await recordEquipmentEvent(
        {
          equipmentId: nc.equipmentId,
          type: "EQUIPAMENTO_LIBERADO",
          description: "Equipamento liberado após validação da correção.",
          userId: user.id,
          nonconformityId: nc.id,
        },
        tx,
      );
      await recordAudit(
        {
          userId: user.id,
          action: "RELEASE",
          entityType: "Equipment",
          entityId: nc.equipmentId,
          previousValue: { status: previousStatus },
          newValue: { status: "LIBERADO" },
        },
        tx,
      );
    }

    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "ActionItem", entityId: actionItemId, newValue: { validated: true } },
      tx,
    );
  });
}

export async function setNonconformityStatus(user: CurrentUser, id: string, status: NonconformityStatus) {
  requirePermission(user, PERMISSIONS.NONCONFORMITY_TREAT);
  const before = await db.nonconformity.findUniqueOrThrow({ where: { id } });
  const nc = await db.nonconformity.update({ where: { id }, data: { status } });
  await recordAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entityType: "Nonconformity",
    entityId: id,
    previousValue: { status: before.status },
    newValue: { status },
  });
  return nc;
}
