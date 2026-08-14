import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { nextFriendlyCode } from "@/server/services/sequence";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { EpiDeliveryReason } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

// =========================================================================
// Tipos de EPI (catálogo)
// =========================================================================

export type EpiTypeInput = {
  name: string;
  defaultCa?: string | null;
  validityMonths?: number | null;
};

export function listEpiTypes(user: CurrentUser, filters: { onlyActive?: boolean } = {}) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  return db.epiType.findMany({
    where: { active: filters.onlyActive ? true : undefined },
    orderBy: { name: "asc" },
  });
}

export async function createEpiType(user: CurrentUser, data: EpiTypeInput) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  const type = await db.epiType.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "EpiType",
    entityId: type.id,
    newValue: data,
  });
  return type;
}

export async function updateEpiType(user: CurrentUser, id: string, data: EpiTypeInput) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  const before = await db.epiType.findUniqueOrThrow({ where: { id } });
  const type = await db.epiType.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "EpiType",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return type;
}

export async function setEpiTypeActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  const before = await db.epiType.findUniqueOrThrow({ where: { id } });
  const type = await db.epiType.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "EpiType",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return type;
}

// =========================================================================
// Funções (cargos) e kit de EPI padrão
// =========================================================================

export function listJobFunctions(user: CurrentUser, filters: { onlyActive?: boolean } = {}) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  return db.jobFunction.findMany({
    where: { active: filters.onlyActive ? true : undefined },
    orderBy: { name: "asc" },
  });
}

/** Lista de funções pro seletor do formulário de colaborador — qualquer usuário com permissão de gerenciar colaboradores. */
export function listJobFunctionsForCollaboratorForm(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  return db.jobFunction.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createJobFunction(user: CurrentUser, data: { name: string }) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  const jobFunction = await db.jobFunction.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "JobFunction",
    entityId: jobFunction.id,
    newValue: data,
  });
  return jobFunction;
}

export async function setJobFunctionActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  const before = await db.jobFunction.findUniqueOrThrow({ where: { id } });
  const jobFunction = await db.jobFunction.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "JobFunction",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return jobFunction;
}

export function getJobFunctionKit(user: CurrentUser, jobFunctionId: string) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);
  return db.jobFunctionEpiKitItem.findMany({
    where: { jobFunctionId },
    include: { epiType: true },
    orderBy: { epiType: { name: "asc" } },
  });
}

export type JobFunctionKitItemInput = { epiTypeId: string; quantity: number };

/** Substitui a lista completa do kit de EPI de uma função. */
export async function setJobFunctionKit(
  user: CurrentUser,
  jobFunctionId: string,
  items: JobFunctionKitItemInput[],
) {
  requirePermission(user, PERMISSIONS.EPI_MANAGE);

  await db.$transaction(async (tx) => {
    await tx.jobFunctionEpiKitItem.deleteMany({ where: { jobFunctionId } });
    if (items.length > 0) {
      await tx.jobFunctionEpiKitItem.createMany({
        data: items.map((item) => ({
          jobFunctionId,
          epiTypeId: item.epiTypeId,
          quantity: item.quantity,
        })),
      });
    }
    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "JobFunctionEpiKit",
        entityId: jobFunctionId,
        newValue: items,
      },
      tx,
    );
  });

  return getJobFunctionKit(user, jobFunctionId);
}

// =========================================================================
// Entregas de EPI (ficha do colaborador)
// =========================================================================

export function listEpiDeliveriesForCollaborator(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  return db.epiDelivery.findMany({
    where: { collaboratorId },
    include: { epiType: true, createdBy: true },
    orderBy: { deliveredAt: "desc" },
  });
}

export type EpiDeliveryInput = {
  collaboratorId: string;
  epiTypeId: string;
  quantity: number;
  ca?: string | null;
  size?: string | null;
  reason: EpiDeliveryReason;
  deliveredAt: Date;
  traceable: boolean;
};

/** Cria a linha da ficha (e, se rastreável, o QR code + código individual do item). Uso interno, chamado
 * dentro de uma transação já aberta pelo chamador (permissão já verificada por ele). */
async function insertEpiDelivery(tx: Tx, data: EpiDeliveryInput, createdById: string) {
  const traceInfo = data.traceable
    ? { qrToken: crypto.randomUUID(), code: await nextFriendlyCode("epi_delivery", "EPI", 6, tx) }
    : { qrToken: null, code: null };

  const delivery = await tx.epiDelivery.create({
    data: {
      collaboratorId: data.collaboratorId,
      epiTypeId: data.epiTypeId,
      quantity: data.quantity,
      ca: data.ca ?? null,
      size: data.size ?? null,
      reason: data.reason,
      deliveredAt: data.deliveredAt,
      traceable: data.traceable,
      qrToken: traceInfo.qrToken,
      code: traceInfo.code,
      createdById,
    },
  });

  await recordAudit(
    {
      userId: createdById,
      action: "CREATE",
      entityType: "EpiDelivery",
      entityId: delivery.id,
      newValue: data,
    },
    tx,
  );

  return delivery;
}

export async function createEpiDelivery(user: CurrentUser, data: EpiDeliveryInput) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  return db.$transaction((tx) => insertEpiDelivery(tx, data, user.id));
}

export async function markEpiDeliveryReturned(user: CurrentUser, id: string, returnedAt: Date) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const before = await db.epiDelivery.findUniqueOrThrow({ where: { id } });
  const delivery = await db.epiDelivery.update({ where: { id }, data: { returnedAt } });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "EpiDelivery",
    entityId: id,
    previousValue: { returnedAt: before.returnedAt },
    newValue: { returnedAt },
  });
  return delivery;
}

/**
 * Aplica o kit de EPI padrão de uma função a um colaborador: para cada item do kit, se o
 * colaborador ainda não tem uma entrega ativa (não devolvida) daquele tipo, cria a entrega com
 * motivo "Primeira entrega". Chamado de dentro da transação de criação/edição do colaborador
 * (`collaborator.service.ts`) — não verifica permissão própria, pois quem chama já verificou
 * `COLLABORATOR_MANAGE`.
 */
export async function applyJobFunctionKit(
  tx: Tx,
  params: { collaboratorId: string; jobFunctionId: string; deliveredAt: Date; createdById: string },
) {
  const [kitItems, existingActive] = await Promise.all([
    tx.jobFunctionEpiKitItem.findMany({ where: { jobFunctionId: params.jobFunctionId } }),
    tx.epiDelivery.findMany({
      where: { collaboratorId: params.collaboratorId, returnedAt: null },
      select: { epiTypeId: true },
    }),
  ]);

  const alreadyCovered = new Set(existingActive.map((d) => d.epiTypeId));

  for (const item of kitItems) {
    if (alreadyCovered.has(item.epiTypeId)) continue;
    await insertEpiDelivery(
      tx,
      {
        collaboratorId: params.collaboratorId,
        epiTypeId: item.epiTypeId,
        quantity: item.quantity,
        reason: "PRIMEIRA_ENTREGA",
        deliveredAt: params.deliveredAt,
        traceable: false,
      },
      params.createdById,
    );
  }
}
