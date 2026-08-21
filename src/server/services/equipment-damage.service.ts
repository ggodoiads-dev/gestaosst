import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { EquipmentDamageStatus } from "@/generated/prisma/enums";

export type EquipmentDamageInput = {
  equipmentId: string;
  date: Date;
  collaboratorId?: string | null;
  description: string;
  cost?: number | null;
  notes?: string | null;
};

/** Lista enxuta de colaboradores ativos pro seletor de "responsável" — não usa
 * `listCollaboratorsForUser` porque aquela exige COLLABORATOR_MANAGE, permissão que um
 * supervisor de chão (que só tem EQUIPMENT_DAMAGE_MANAGE) não necessariamente tem. */
export function listCollaboratorsForDamageForm(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  return db.collaborator.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function listEquipmentDamagesForUser(user: CurrentUser, filters: { status?: EquipmentDamageStatus | "ALL" } = {}) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  const where = filters.status && filters.status !== "ALL" ? { status: filters.status } : {};
  return db.equipmentDamage.findMany({
    where,
    include: { equipment: true, collaborator: true },
    orderBy: { date: "desc" },
  });
}

export async function getEquipmentDamageDetail(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  return db.equipmentDamage.findUniqueOrThrow({
    where: { id },
    include: {
      equipment: true,
      collaborator: true,
      reportedBy: true,
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
    },
  });
}

export async function createEquipmentDamage(user: CurrentUser, data: EquipmentDamageInput) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);

  return db.$transaction(async (tx) => {
    const code = await nextFriendlyCode("equipment_damage", "AVA", 6, tx);
    const created = await tx.equipmentDamage.create({
      data: {
        code,
        equipmentId: data.equipmentId,
        date: data.date,
        collaboratorId: data.collaboratorId || null,
        description: data.description,
        cost: data.cost ?? null,
        notes: data.notes || null,
        reportedById: user.id,
      },
    });

    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "EquipmentDamage", entityId: created.id, newValue: data },
      tx,
    );

    return created;
  });
}

export async function updateEquipmentDamage(user: CurrentUser, id: string, data: EquipmentDamageInput) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  const before = await db.equipmentDamage.findUniqueOrThrow({ where: { id } });

  return db.$transaction(async (tx) => {
    const updated = await tx.equipmentDamage.update({
      where: { id },
      data: {
        equipmentId: data.equipmentId,
        date: data.date,
        collaboratorId: data.collaboratorId || null,
        description: data.description,
        cost: data.cost ?? null,
        notes: data.notes || null,
      },
    });

    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "EquipmentDamage", entityId: id, previousValue: before, newValue: data },
      tx,
    );

    return updated;
  });
}

export async function updateEquipmentDamageStatus(user: CurrentUser, id: string, status: EquipmentDamageStatus) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  const before = await db.equipmentDamage.findUniqueOrThrow({ where: { id } });

  const updated = await db.equipmentDamage.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVIDO" ? new Date() : before.resolvedAt },
  });

  await recordAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entityType: "EquipmentDamage",
    entityId: id,
    previousValue: { status: before.status },
    newValue: { status },
  });

  return updated;
}

/** Anexa uma evidência (foto do dano, orçamento etc.) — sempre adiciona, nunca substitui. */
export async function attachEquipmentDamageFile(
  user: CurrentUser,
  equipmentDamageId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  await db.equipmentDamage.findUniqueOrThrow({ where: { id: equipmentDamageId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "AVARIA",
      equipmentDamageId,
      uploadedById: user.id,
    },
  });
}

export type EquipmentDamageCostSummary = {
  totalCost: number;
  openCount: number;
  totalCount: number;
  byEquipment: { equipmentId: string; equipmentCode: string; equipmentName: string; totalCost: number; count: number }[];
};

/** Soma o custo das avarias no período — base do painel Financeiro. */
export async function getEquipmentDamageCostSummary(
  user: CurrentUser,
  range: { from: Date; to: Date },
): Promise<EquipmentDamageCostSummary> {
  requirePermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);

  const damages = await db.equipmentDamage.findMany({
    where: { date: { gte: range.from, lte: range.to } },
    include: { equipment: true },
  });

  const byEquipmentMap = new Map<string, { equipmentCode: string; equipmentName: string; totalCost: number; count: number }>();
  let totalCost = 0;
  let openCount = 0;

  for (const d of damages) {
    const cost = d.cost ? Number(d.cost) : 0;
    totalCost += cost;
    if (d.status !== "RESOLVIDO") openCount++;

    const entry = byEquipmentMap.get(d.equipmentId) ?? {
      equipmentCode: d.equipment.code,
      equipmentName: d.equipment.name,
      totalCost: 0,
      count: 0,
    };
    entry.totalCost += cost;
    entry.count += 1;
    byEquipmentMap.set(d.equipmentId, entry);
  }

  const byEquipment = Array.from(byEquipmentMap.entries())
    .map(([equipmentId, v]) => ({ equipmentId, ...v }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return { totalCost, openCount, totalCount: damages.length, byEquipment };
}
