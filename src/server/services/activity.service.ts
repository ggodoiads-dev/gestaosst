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

  const popDocs = documents.filter((d) => d.docType === "POP");
  const arVrDocs = documents.filter((d) => d.docType === "AR_VR");
  const listaTreinamentoDocs = documents.filter((d) => d.docType === "LISTA_TREINAMENTO");

  return { activity, documents, popDocs, arVrDocs, listaTreinamentoDocs };
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

/** Atividades ativas + quais delas este colaborador está apto a realizar — base do card
 * "Atividades" e do diálogo de edição na ficha do colaborador. */
export async function listActivityAptitudesForCollaborator(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);

  const [activities, aptitudes] = await Promise.all([
    db.activity.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.collaboratorActivity.findMany({ where: { collaboratorId }, select: { activityId: true } }),
  ]);

  const aptActivityIds = new Set(aptitudes.map((a) => a.activityId));
  return activities.map((activity) => ({ activity, apt: aptActivityIds.has(activity.id) }));
}

/** Substitui o conjunto inteiro de atividades que o colaborador está apto a realizar (marca as
 * novas, desmarca as que saíram) — mais simples de operar num diálogo de checkboxes do que
 * conceder/revogar uma de cada vez. */
export async function setCollaboratorActivityAptitudes(user: CurrentUser, collaboratorId: string, activityIds: string[]) {
  requirePermission(user, PERMISSIONS.COLLABORATOR_MANAGE);

  const before = await db.collaboratorActivity.findMany({ where: { collaboratorId }, select: { activityId: true } });
  const beforeIds = new Set(before.map((a) => a.activityId));
  const afterIds = new Set(activityIds);

  await db.$transaction(async (tx) => {
    const toRemove = [...beforeIds].filter((id) => !afterIds.has(id));
    const toAdd = [...afterIds].filter((id) => !beforeIds.has(id));

    if (toRemove.length > 0) {
      await tx.collaboratorActivity.deleteMany({ where: { collaboratorId, activityId: { in: toRemove } } });
    }
    if (toAdd.length > 0) {
      await tx.collaboratorActivity.createMany({
        data: toAdd.map((activityId) => ({ collaboratorId, activityId, grantedById: user.id })),
      });
    }
    await recordAudit(
      {
        userId: user.id,
        action: "UPDATE",
        entityType: "Collaborator",
        entityId: collaboratorId,
        previousValue: { activityIds: [...beforeIds] },
        newValue: { activityIds: [...afterIds] },
      },
      tx,
    );
  });
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
