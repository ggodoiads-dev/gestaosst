import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { AttachmentDocType } from "@/generated/prisma/enums";

export type ActivityInput = {
  name: string;
  code?: string | null;
  description?: string | null;
  unit?: string | null;
};

export function listActivitiesForUser(user: CurrentUser, filters: { search?: string } = {}) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);
  return db.activity.findMany({
    where: {
      OR: filters.search
        ? [{ name: { contains: filters.search } }, { code: { contains: filters.search } }]
        : undefined,
    },
    orderBy: { name: "asc" },
  });
}

/** Catálogo de atividades ativas pro colaborador escolher ao lançar a própria produtividade —
 * não exige `ACTIVITY_MANAGE` (que é sobre cadastrar/editar atividades), só ler a lista. */
export function listActiveActivitiesForSelfLog(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.PRODUCTIVITY_SELF_LOG);
  return db.activity.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

/** Mapa activityId -> presença de cada tipo de documento, com o anexo mais recente, para a listagem. */
export async function listLatestActivityDocuments(
  activityIds: string[],
): Promise<Record<string, { pop: boolean; arVr: boolean; listaTreinamento: boolean }>> {
  if (activityIds.length === 0) return {};
  const attachments = await db.attachment.findMany({
    where: { activityId: { in: activityIds }, context: "ATIVIDADE" },
    orderBy: { uploadedAt: "desc" },
  });
  const map: Record<string, { pop: boolean; arVr: boolean; listaTreinamento: boolean }> = {};
  for (const attachment of attachments) {
    if (!attachment.activityId) continue;
    map[attachment.activityId] ??= { pop: false, arVr: false, listaTreinamento: false };
    if (attachment.docType === "POP") map[attachment.activityId].pop = true;
    if (attachment.docType === "AR_VR") map[attachment.activityId].arVr = true;
    if (attachment.docType === "LISTA_TREINAMENTO") map[attachment.activityId].listaTreinamento = true;
  }
  return map;
}

export async function getActivityDetail(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);

  const [activity, documents] = await Promise.all([
    db.activity.findUniqueOrThrow({ where: { id } }),
    db.attachment.findMany({
      where: { activityId: id, context: "ATIVIDADE" },
      include: { uploadedBy: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  const currentPop = documents.find((d) => d.docType === "POP") ?? null;
  const currentArVr = documents.find((d) => d.docType === "AR_VR") ?? null;
  const currentListaTreinamento = documents.find((d) => d.docType === "LISTA_TREINAMENTO") ?? null;

  return { activity, documents, currentPop, currentArVr, currentListaTreinamento };
}

export async function createActivity(user: CurrentUser, data: ActivityInput) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);

  const activity = await db.$transaction(async (tx) => {
    const created = await tx.activity.create({ data });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Activity", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return activity;
}

export async function updateActivity(user: CurrentUser, id: string, data: ActivityInput) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);
  const before = await db.activity.findUniqueOrThrow({ where: { id } });

  const activity = await db.$transaction(async (tx) => {
    const updated = await tx.activity.update({ where: { id }, data });
    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "Activity", entityId: id, previousValue: before, newValue: data },
      tx,
    );
    return updated;
  });

  return activity;
}

export async function setActivityActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);
  const before = await db.activity.findUniqueOrThrow({ where: { id } });
  const activity = await db.activity.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "Activity",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return activity;
}

/** Anexa uma nova versão de POP ou AR/VR — versões anteriores continuam no histórico (seção 44: nunca sobrescrever). */
export async function attachActivityDocument(
  user: CurrentUser,
  activityId: string,
  docType: AttachmentDocType,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.ACTIVITY_MANAGE);
  await db.activity.findUniqueOrThrow({ where: { id: activityId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "ATIVIDADE",
      docType,
      activityId,
      uploadedById: user.id,
    },
  });
}
