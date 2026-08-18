import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordEquipmentEvent } from "@/server/services/equipment-events";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, requireAreaAccess } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { Criticality } from "@/generated/prisma/enums";

export type EquipmentInput = {
  code: string;
  name: string;
  assetTag?: string | null;
  typeId: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  unitId: string;
  areaId: string;
  sector?: string | null;
  responsibleId?: string | null;
  criticality: Criticality;
  notes?: string | null;
};

/** Lista equipamentos respeitando as áreas permitidas do usuário, salvo quando ele possui acesso a todas as áreas. */
export function listEquipmentsForUser(
  user: CurrentUser,
  filters: { areaId?: string; typeId?: string; status?: string; criticality?: string; search?: string } = {},
) {
  const canSeeAll = user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  return db.equipment.findMany({
    where: {
      active: true,
      areaId: canSeeAll ? filters.areaId : { in: filters.areaId ? [filters.areaId] : Array.from(user.areaIds) },
      typeId: filters.typeId || undefined,
      status: (filters.status as never) || undefined,
      criticality: (filters.criticality as never) || undefined,
      OR: filters.search
        ? [
            { code: { contains: filters.search } },
            { name: { contains: filters.search } },
            { assetTag: { contains: filters.search } },
          ]
        : undefined,
    },
    include: { type: true, area: { include: { unit: true } }, responsible: true },
    orderBy: { code: "asc" },
  });
}

export async function getEquipmentDetail(user: CurrentUser, id: string) {
  const equipment = await db.equipment.findUniqueOrThrow({
    where: { id },
    include: {
      type: true,
      area: { include: { unit: true } },
      unit: true,
      responsible: true,
      registeredBy: true,
      assignments: { include: { template: true } },
    },
  });
  requireAreaAccess(user, equipment.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  return equipment;
}

export function getEquipmentTimeline(equipmentId: string, take = 100) {
  return db.equipmentEvent.findMany({
    where: { equipmentId },
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    take,
  });
}

export async function getEquipmentProntuario(user: CurrentUser, id: string) {
  const equipment = await getEquipmentDetail(user, id);

  const [lastExecution, openNonconformities, openActionItems, timeline, photo] = await Promise.all([
    db.checklistExecution.findFirst({
      where: { equipmentId: id, status: "CONCLUIDO" },
      orderBy: { finishedAt: "desc" },
      include: { executedBy: true },
    }),
    db.nonconformity.findMany({
      where: { equipmentId: id, status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } },
      orderBy: { identifiedAt: "desc" },
    }),
    db.actionItem.findMany({
      where: {
        actionPlan: { nonconformity: { equipmentId: id } },
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      },
      include: { responsible: true, actionPlan: { include: { nonconformity: true } } },
      orderBy: { dueDate: "asc" },
    }),
    getEquipmentTimeline(id),
    getEquipmentPhoto(id),
  ]);

  return { equipment, lastExecution, openNonconformities, openActionItems, timeline, photo };
}

export function listEquipmentsByType(typeId: string) {
  return db.equipment.findMany({
    where: { typeId, active: true },
    include: { area: true },
    orderBy: { code: "asc" },
  });
}

export function listAllEquipmentsForAdmin() {
  return db.equipment.findMany({
    include: { type: true, area: { include: { unit: true } }, responsible: true },
    orderBy: { code: "asc" },
  });
}

export async function createEquipment(user: CurrentUser, data: EquipmentInput) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);

  const equipment = await db.$transaction(async (tx) => {
    const created = await tx.equipment.create({
      data: { ...data, registeredById: user.id },
    });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Equipment", entityId: created.id, newValue: data },
      tx,
    );
    await recordEquipmentEvent(
      {
        equipmentId: created.id,
        type: "EQUIPAMENTO_CADASTRADO",
        description: `Equipamento ${created.code} cadastrado.`,
        userId: user.id,
      },
      tx,
    );
    return created;
  });

  return equipment;
}

export async function updateEquipment(user: CurrentUser, id: string, data: EquipmentInput) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);
  const before = await db.equipment.findUniqueOrThrow({ where: { id } });

  const equipment = await db.$transaction(async (tx) => {
    const updated = await tx.equipment.update({ where: { id }, data });
    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "Equipment",
        entityId: id,
        previousValue: before,
        newValue: data,
      },
      tx,
    );

    if (before.areaId !== data.areaId) {
      await tx.equipmentAreaHistory.create({
        data: {
          equipmentId: id,
          previousAreaId: before.areaId,
          newAreaId: data.areaId,
          changedById: user.id,
        },
      });
      await recordEquipmentEvent(
        {
          equipmentId: id,
          type: "MUDANCA_DE_AREA",
          description: "Equipamento transferido de área.",
          userId: user.id,
        },
        tx,
      );
    }

    if (before.responsibleId !== data.responsibleId) {
      await recordEquipmentEvent(
        {
          equipmentId: id,
          type: "MUDANCA_DE_RESPONSAVEL",
          description: "Responsável pelo equipamento alterado.",
          userId: user.id,
        },
        tx,
      );
    }

    return updated;
  });

  return equipment;
}

export function getEquipmentPhoto(equipmentId: string) {
  return db.attachment.findFirst({
    where: { equipmentId, context: "EQUIPAMENTO" },
    orderBy: { uploadedAt: "desc" },
  });
}

/** Mapa equipmentId -> caminho da foto mais recente, para listagens com várias linhas. */
export async function listLatestEquipmentPhotos(equipmentIds: string[]): Promise<Record<string, string>> {
  if (equipmentIds.length === 0) return {};
  const attachments = await db.attachment.findMany({
    where: { equipmentId: { in: equipmentIds }, context: "EQUIPAMENTO" },
    orderBy: { uploadedAt: "desc" },
  });
  const map: Record<string, string> = {};
  for (const attachment of attachments) {
    if (attachment.equipmentId && !map[attachment.equipmentId]) {
      map[attachment.equipmentId] = attachment.path;
    }
  }
  return map;
}

/** Anexa/substitui a foto de capa do equipamento (seção 14/41 do documento). */
export async function attachEquipmentPhoto(
  user: CurrentUser,
  equipmentId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);
  const equipment = await db.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
  requireAreaAccess(user, equipment.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  await db.$transaction(async (tx) => {
    await tx.attachment.create({
      data: {
        filename: file.filename,
        path: file.path,
        mimeType: file.mimeType,
        size: file.size,
        context: "EQUIPAMENTO",
        equipmentId,
        uploadedById: user.id,
      },
    });
    await recordEquipmentEvent(
      {
        equipmentId,
        type: "DOCUMENTO_ANEXADO",
        description: "Foto do equipamento anexada.",
        userId: user.id,
      },
      tx,
    );
  });
}

export async function setEquipmentActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MANAGE);
  const before = await db.equipment.findUniqueOrThrow({ where: { id } });
  const equipment = await db.equipment.update({
    where: { id },
    data: { active, status: active ? before.status : "INATIVO" },
  });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Equipment",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return equipment;
}

/** Equipamentos ativos + quais deles este colaborador está apto a operar — base do card
 * "Equipamentos" e do diálogo de edição na ficha do colaborador. */
export async function listEquipmentAptitudesForCollaborator(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);

  const [equipments, aptitudes] = await Promise.all([
    db.equipment.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.collaboratorEquipment.findMany({ where: { collaboratorId }, select: { equipmentId: true } }),
  ]);

  const aptEquipmentIds = new Set(aptitudes.map((a) => a.equipmentId));
  return equipments.map((equipment) => ({ equipment, apt: aptEquipmentIds.has(equipment.id) }));
}

/** Substitui o conjunto inteiro de equipamentos que o colaborador está apto a operar (marca os
 * novos, desmarca os que saíram) — mesmo padrão de `setCollaboratorActivityAptitudes`. */
export async function setCollaboratorEquipmentAptitudes(user: CurrentUser, collaboratorId: string, equipmentIds: string[]) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);

  const before = await db.collaboratorEquipment.findMany({ where: { collaboratorId }, select: { equipmentId: true } });
  const beforeIds = new Set(before.map((a) => a.equipmentId));
  const afterIds = new Set(equipmentIds);

  await db.$transaction(async (tx) => {
    const toRemove = [...beforeIds].filter((id) => !afterIds.has(id));
    const toAdd = [...afterIds].filter((id) => !beforeIds.has(id));

    if (toRemove.length > 0) {
      await tx.collaboratorEquipment.deleteMany({ where: { collaboratorId, equipmentId: { in: toRemove } } });
    }
    if (toAdd.length > 0) {
      await tx.collaboratorEquipment.createMany({
        data: toAdd.map((equipmentId) => ({ collaboratorId, equipmentId, createdById: user.id })),
      });
    }
    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "Collaborator",
        entityId: collaboratorId,
        previousValue: { equipmentIds: [...beforeIds] },
        newValue: { equipmentIds: [...afterIds] },
      },
      tx,
    );
  });
}
