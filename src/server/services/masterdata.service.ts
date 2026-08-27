import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export function listUnits() {
  return db.unit.findMany({ orderBy: { name: "asc" } });
}

export function listAreas() {
  return db.area.findMany({
    include: { unit: true },
    orderBy: [{ unit: { name: "asc" } }, { name: "asc" }],
  });
}

/** Referência simples pra formulários (ex: atribuir função a um líder em /usuarios) —
 * sem gate de permissão, igual `listAreas`/`listUnits`; quem chama já está numa tela protegida. */
export function listActiveJobFunctions() {
  return db.jobFunction.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function listEquipmentTypes() {
  return db.equipmentType.findMany({ orderBy: { name: "asc" } });
}

export function listFaultCategories() {
  return db.faultCategory.findMany({ orderBy: { name: "asc" } });
}

export async function createUnit(user: CurrentUser, data: { name: string; code: string }) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const unit = await db.unit.create({ data });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Unit", entityId: unit.id, newValue: data });
  return unit;
}

export async function updateUnit(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.unit.findUniqueOrThrow({ where: { id } });
  const unit = await db.unit.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Unit",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return unit;
}

export async function setUnitActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.unit.findUniqueOrThrow({ where: { id } });
  const unit = await db.unit.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Unit",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return unit;
}

export async function createArea(
  user: CurrentUser,
  data: { name: string; code: string; unitId: string; sector?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const area = await db.area.create({ data });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "Area", entityId: area.id, newValue: data });
  return area;
}

export async function updateArea(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string; unitId: string; sector?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.area.findUniqueOrThrow({ where: { id } });
  const area = await db.area.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Area",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return area;
}

export async function setAreaActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.area.findUniqueOrThrow({ where: { id } });
  const area = await db.area.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Area",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return area;
}

export type AreaDocType = "POP" | "AR_VR" | "LISTA_TREINAMENTO";

/** Documentos gerais da área (procedimento/POP e avaliação de risco) — aparecem no QR Code
 * público da área, pra quem trabalha ou fiscaliza ali conseguir consultar sem precisar logar.
 * Nunca sobrescreve: cada envio soma ao histórico (mesmo padrão de `attachActivityDocument`),
 * e o QR mostra sempre o mais recente de cada tipo. */
export async function attachAreaDocument(
  user: CurrentUser,
  areaId: string,
  docType: AreaDocType,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  await db.area.findUniqueOrThrow({ where: { id: areaId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "AREA",
      docType,
      areaId,
      uploadedById: user.id,
    },
  });
}

export async function listAreaDocuments(areaId: string) {
  const docs = await db.attachment.findMany({
    where: { areaId, context: "AREA" },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { uploadedAt: "desc" },
  });
  return {
    pop: docs.filter((d) => d.docType === "POP"),
    arVr: docs.filter((d) => d.docType === "AR_VR"),
    listaTreinamento: docs.filter((d) => d.docType === "LISTA_TREINAMENTO"),
  };
}

/** Documentos da área pro QR público, com fallback pra uma Atividade de MESMO NOME (normalizado,
 * sem diferenciar maiúscula/acento) — na operação já é comum documentar POP/AR-VR/Lista de
 * Treinamento em Atividades com o nome igual ao da área física (ex: "Reforma de Paletes"), então
 * em vez de pedir pra recadastrar tudo de novo em Área, mostra o mais recente entre os dois
 * lugares por tipo. Só casa por nome EXATO (não substring), pra nunca puxar documento de uma
 * atividade sem relação nenhuma com a área. */
export async function getAreaDocumentsForPublicView(area: { id: string; name: string }) {
  const [ownDocs, matchedActivity] = await Promise.all([
    listAreaDocuments(area.id),
    db.activity.findFirst({ where: { name: { equals: area.name, mode: "insensitive" } }, select: { id: true } }),
  ]);

  const activityDocs = matchedActivity
    ? await db.attachment.findMany({
        where: { activityId: matchedActivity.id, context: "ATIVIDADE" },
        orderBy: { uploadedAt: "desc" },
      })
    : [];

  function latestOfType(docType: AreaDocType, ownOfType: { id: string; mimeType: string; uploadedAt: Date }[]) {
    const candidates = [...ownOfType, ...activityDocs.filter((d) => d.docType === docType)];
    return candidates.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0] ?? null;
  }

  return {
    pop: latestOfType("POP", ownDocs.pop),
    arVr: latestOfType("AR_VR", ownDocs.arVr),
    listaTreinamento: latestOfType("LISTA_TREINAMENTO", ownDocs.listaTreinamento),
  };
}

export async function createEquipmentType(
  user: CurrentUser,
  data: { name: string; code: string; description?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const type = await db.equipmentType.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "EquipmentType",
    entityId: type.id,
    newValue: data,
  });
  return type;
}

export async function updateEquipmentType(
  user: CurrentUser,
  id: string,
  data: { name: string; code: string; description?: string | null },
) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const before = await db.equipmentType.findUniqueOrThrow({ where: { id } });
  const type = await db.equipmentType.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "EquipmentType",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return type;
}
