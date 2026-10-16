import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { deleteStoredFile } from "@/server/services/storage";

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

/** Apaga um documento da área (POP / AR-VR / Lista de Treinamento) — definitivo. Só mexe em anexo
 * de contexto AREA, nunca em outro tipo de anexo. */
export async function deleteAreaDocument(user: CurrentUser, attachmentId: string) {
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);
  const attachment = await db.attachment.findFirst({ where: { id: attachmentId, context: "AREA" } });
  if (!attachment) throw new Error("Documento não encontrado.");

  await db.attachment.delete({ where: { id: attachment.id } });
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Attachment",
    entityId: attachment.id,
    previousValue: { filename: attachment.filename, docType: attachment.docType, areaId: attachment.areaId },
  });
  await deleteStoredFile(attachment.path);
  return attachment.areaId;
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

/** Documentos da área pro QR público: os da própria área + os das Atividades LIGADAS a ela (escolhidas na tela da atividade)
 * + o fallback pra uma Atividade de MESMO NOME (normalizado,
 * sem diferenciar maiúscula/acento) — na operação já é comum documentar POP/AR-VR/Lista de
 * Treinamento em Atividades com o nome igual ao da área física (ex: "Reforma de Paletes"), então
 * em vez de pedir pra recadastrar tudo de novo em Área, mostra o mais recente entre os dois
 * lugares por tipo. Só casa por nome EXATO (não substring), pra nunca puxar documento de uma
 * atividade sem relação nenhuma com a área. */
export async function getAreaDocumentsForPublicView(area: { id: string; name: string }) {
  const [ownDocs, matchedActivity, linkedActivities] = await Promise.all([
    listAreaDocuments(area.id),
    db.activity.findFirst({ where: { name: { equals: area.name, mode: "insensitive" } }, select: { id: true } }),
    // Atividades que o gestor ligou a esta área (em Atividades e Documentos). Tolera a tabela ainda não migrada.
    db.activityArea.findMany({ where: { areaId: area.id, activity: { active: true } }, select: { activityId: true } }).catch(() => [] as { activityId: string }[]),
  ]);

  const activityIds = [...new Set([...(matchedActivity ? [matchedActivity.id] : []), ...linkedActivities.map((l) => l.activityId)])];
  const activityDocs =
    activityIds.length > 0
      ? await db.attachment.findMany({
          where: { activityId: { in: activityIds }, context: "ATIVIDADE" },
          orderBy: { uploadedAt: "desc" },
        })
      : [];

  function latestOfType(
    docType: AreaDocType,
    ownOfType: { id: string; mimeType: string; uploadedAt: Date; filename: string; path: string }[],
  ) {
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

export type AreaPublicDoc = { id: string; mimeType: string; filename: string; path: string; uploadedAt: Date };
export type AreaActivityDocs = {
  id: string;
  name: string;
  code: string | null;
  pop: AreaPublicDoc | null;
  arVr: AreaPublicDoc | null;
  listaTreinamento: AreaPublicDoc | null;
};
export type AreaLeader = { name: string; turnos: string[] };

/**
 * Visão completa da área pro QR Code (visitante) e pra tela de Áreas: os documentos gerais da área, os documentos de CADA atividade
 * ligada a ela (POP, AR/VR e Lista de Treinamento mais recentes de cada atividade, separados por atividade) e a liderança da área.
 * Atividades da área = as ligadas pelo gestor na tela da atividade + a de mesmo nome da área (como já era). Liderança = quem "faz a
 * chamada" daquela área (Usuários e Permissões), com os turnos dele quando tiver turnos definidos.
 */
export async function getAreaPublicOverview(area: { id: string; name: string }) {
  const [ownDocs, matchedActivity, linked, leaders] = await Promise.all([
    listAreaDocuments(area.id),
    db.activity.findFirst({ where: { name: { equals: area.name, mode: "insensitive" } }, select: { id: true } }),
    db.activityArea.findMany({ where: { areaId: area.id }, select: { activityId: true } }).catch(() => [] as { activityId: string }[]),
    db.user.findMany({
      where: { active: true, canRollCall: true, userRollCallAreas: { some: { areaId: area.id } } },
      select: { name: true, userRollCallTurnos: { select: { turno: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const activityIds = [...new Set([...(matchedActivity ? [matchedActivity.id] : []), ...linked.map((l) => l.activityId)])];
  const activities =
    activityIds.length > 0
      ? await db.activity.findMany({
          where: { id: { in: activityIds }, active: true },
          select: {
            id: true,
            name: true,
            code: true,
            attachments: {
              where: { context: "ATIVIDADE" },
              select: { id: true, mimeType: true, filename: true, path: true, uploadedAt: true, docType: true },
              orderBy: { uploadedAt: "desc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [];

  const latest = (docs: { docType: string | null; id: string; mimeType: string; filename: string; path: string; uploadedAt: Date }[], type: AreaDocType) =>
    docs.find((d) => d.docType === type) ?? null;

  const groups: AreaActivityDocs[] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    pop: latest(a.attachments, "POP"),
    arVr: latest(a.attachments, "AR_VR"),
    listaTreinamento: latest(a.attachments, "LISTA_TREINAMENTO"),
  }));

  const own = {
    pop: ownDocs.pop[0] ?? null,
    arVr: ownDocs.arVr[0] ?? null,
    listaTreinamento: ownDocs.listaTreinamento[0] ?? null,
  };

  return {
    general: own.pop || own.arVr || own.listaTreinamento ? own : null,
    activities: groups,
    leaders: leaders.map((l): AreaLeader => ({ name: l.name, turnos: l.userRollCallTurnos.map((t) => t.turno.name).sort() })),
  };
}
