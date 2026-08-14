import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { recordEquipmentEvent } from "@/server/services/equipment-events";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, requireAreaAccess, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { EquipmentStatus } from "@/generated/prisma/enums";

/** Equipamentos que precisam de atenção: bloqueados, restritos ou já em manutenção. */
export function listMaintenanceQueue(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MAINTENANCE);
  const canSeeAll = user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  return db.equipment.findMany({
    where: {
      active: true,
      status: { in: ["BLOQUEADO", "RESTRITO", "EM_MANUTENCAO"] },
      areaId: canSeeAll ? undefined : { in: Array.from(user.areaIds) },
    },
    include: {
      area: true,
      type: true,
      responsible: true,
      nonconformities: {
        where: { status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } },
        orderBy: { identifiedAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { code: "asc" }],
  });
}

/** Coloca o equipamento em manutenção manualmente (seção 38 — evento MANUTENCAO_INICIADA). */
export async function startMaintenance(user: CurrentUser, equipmentId: string, note: string | null) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MAINTENANCE);
  const equipment = await db.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
  requireAreaAccess(user, equipment.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  if (equipment.status === "EM_MANUTENCAO") {
    throw new ForbiddenError("Este equipamento já está em manutenção.");
  }

  const previousStatus = equipment.status;

  await db.$transaction(async (tx) => {
    await tx.equipment.update({ where: { id: equipmentId }, data: { status: "EM_MANUTENCAO" } });
    await recordEquipmentEvent(
      {
        equipmentId,
        type: "MANUTENCAO_INICIADA",
        description: note?.trim() ? note.trim() : "Equipamento colocado em manutenção.",
        userId: user.id,
      },
      tx,
    );
    await recordAudit(
      {
        userId: user.id,
        action: "STATUS_CHANGE",
        entityType: "Equipment",
        entityId: equipmentId,
        previousValue: { status: previousStatus },
        newValue: { status: "EM_MANUTENCAO" },
      },
      tx,
    );
  });
}

export type CompleteMaintenanceInput = {
  description: string;
  newStatus: Extract<EquipmentStatus, "LIBERADO" | "BLOQUEADO" | "EM_MANUTENCAO">;
};

/**
 * Registra o que foi feito/trocado na manutenção e decide se o equipamento
 * volta a operar ou permanece bloqueado (o usuário pode não conseguir
 * resolver o problema na primeira tentativa).
 */
export async function completeMaintenance(
  user: CurrentUser,
  equipmentId: string,
  input: CompleteMaintenanceInput,
) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_MAINTENANCE);
  const equipment = await db.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
  requireAreaAccess(user, equipment.areaId, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  await db.$transaction(async (tx) => {
    await tx.equipment.update({ where: { id: equipmentId }, data: { status: input.newStatus } });

    await recordEquipmentEvent(
      {
        equipmentId,
        type: "MANUTENCAO_CONCLUIDA",
        description: input.description.trim(),
        userId: user.id,
      },
      tx,
    );

    if (input.newStatus === "LIBERADO") {
      await recordEquipmentEvent(
        {
          equipmentId,
          type: "EQUIPAMENTO_LIBERADO",
          description: "Equipamento liberado após manutenção.",
          userId: user.id,
        },
        tx,
      );
    }

    await recordAudit(
      {
        userId: user.id,
        action: "STATUS_CHANGE",
        entityType: "Equipment",
        entityId: equipmentId,
        previousValue: { status: "EM_MANUTENCAO" },
        newValue: { status: input.newStatus, manutencao: input.description },
      },
      tx,
    );
  });
}
