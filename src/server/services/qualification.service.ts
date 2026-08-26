import "server-only";
import { addMonths } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { QualificationCategory } from "@/generated/prisma/enums";

export type QualificationTypeInput = {
  name: string;
  category: QualificationCategory;
  validityMonths?: number | null;
  aliases?: string[];
};

export function listQualificationTypes(user: CurrentUser, filters: { onlyActive?: boolean } = {}) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  return db.qualificationType.findMany({
    where: { active: filters.onlyActive ? true : undefined },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function createQualificationType(user: CurrentUser, data: QualificationTypeInput) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const type = await db.qualificationType.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "QualificationType",
    entityId: type.id,
    newValue: data,
  });
  return type;
}

/** Editar a validade de um tipo (ex: 24 meses -> 12) só valeria pros próximos registros se
 * `expiresAt` não fosse recalculado aqui — como ele é gravado uma vez na criação do registro
 * (createQualificationRecord), sem esse recálculo em cascata os QR codes e o painel continuavam
 * mostrando o vencimento antigo pra quem já tinha o registro cadastrado antes da edição. */
export async function updateQualificationType(user: CurrentUser, id: string, data: QualificationTypeInput) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const before = await db.qualificationType.findUniqueOrThrow({ where: { id } });

  const type = await db.$transaction(async (tx) => {
    const updated = await tx.qualificationType.update({ where: { id }, data });

    if (before.validityMonths !== data.validityMonths) {
      const records = await tx.qualificationRecord.findMany({ where: { qualificationTypeId: id } });
      for (const record of records) {
        const expiresAt = data.validityMonths ? addMonths(record.completedDate, data.validityMonths) : null;
        if (expiresAt?.getTime() !== record.expiresAt?.getTime()) {
          await tx.qualificationRecord.update({ where: { id: record.id }, data: { expiresAt } });
        }
      }
    }

    return updated;
  });

  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "QualificationType",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return type;
}

export async function setQualificationTypeActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const before = await db.qualificationType.findUniqueOrThrow({ where: { id } });
  const type = await db.qualificationType.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "QualificationType",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return type;
}

export type QualificationRecordInput = {
  collaboratorId: string;
  qualificationTypeId: string;
  completedDate: Date;
  notes?: string | null;
};

export async function createQualificationRecord(user: CurrentUser, data: QualificationRecordInput) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const type = await db.qualificationType.findUniqueOrThrow({ where: { id: data.qualificationTypeId } });
  const expiresAt = type.validityMonths ? addMonths(data.completedDate, type.validityMonths) : null;

  const record = await db.$transaction(async (tx) => {
    const created = await tx.qualificationRecord.create({
      data: {
        collaboratorId: data.collaboratorId,
        qualificationTypeId: data.qualificationTypeId,
        completedDate: data.completedDate,
        expiresAt,
        notes: data.notes ?? null,
        createdById: user.id,
      },
    });
    await recordAudit(
      {
        userId: user.id,
        action: "CREATE",
        entityType: "QualificationRecord",
        entityId: created.id,
        newValue: { ...data, expiresAt },
      },
      tx,
    );
    return created;
  });

  return record;
}

/** Corrige um registro já lançado (NR errada, data errada) direto do perfil do colaborador —
 * recalcula expiresAt a partir da validade atual do tipo (pode ter mudado desde o lançamento). */
export async function updateQualificationRecord(user: CurrentUser, id: string, data: QualificationRecordInput) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const before = await db.qualificationRecord.findUniqueOrThrow({ where: { id } });
  const type = await db.qualificationType.findUniqueOrThrow({ where: { id: data.qualificationTypeId } });
  const expiresAt = type.validityMonths ? addMonths(data.completedDate, type.validityMonths) : null;

  const record = await db.$transaction(async (tx) => {
    const updated = await tx.qualificationRecord.update({
      where: { id },
      data: {
        collaboratorId: data.collaboratorId,
        qualificationTypeId: data.qualificationTypeId,
        completedDate: data.completedDate,
        expiresAt,
        notes: data.notes ?? null,
      },
    });
    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "QualificationRecord", entityId: id, previousValue: before, newValue: { ...data, expiresAt } },
      tx,
    );
    return updated;
  });

  return record;
}

/** Anexa o arquivo do certificado (PDF/foto) a um registro — sempre adiciona, nunca substitui
 * (mesmo padrão de `attachAccidentFile`); a mais recente é a exibida no QR público. */
export async function attachQualificationFile(
  user: CurrentUser,
  qualificationRecordId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  await db.qualificationRecord.findUniqueOrThrow({ where: { id: qualificationRecordId } });

  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "QUALIFICACAO",
      qualificationRecordId,
      uploadedById: user.id,
    },
  });
}

/** Remove um registro lançado por engano (não pra renovação — pra isso é só lançar um novo, o
 * histórico existe justamente pra guardar as renovações anteriores). Apaga de vez, não é
 * soft-delete: diferente de acidente/NC, um lançamento errado de qualificação não tem valor
 * nenhum de manter — mas fica registrado no log de auditoria antes de sumir. */
export async function deleteQualificationRecord(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const before = await db.qualificationRecord.findUniqueOrThrow({ where: { id } });

  await db.$transaction(async (tx) => {
    await tx.attachment.deleteMany({ where: { qualificationRecordId: id } });
    await tx.qualificationRecord.delete({ where: { id } });
    await recordAudit(
      { userId: user.id, action: "DELETE", entityType: "QualificationRecord", entityId: id, previousValue: before },
      tx,
    );
  });
}

/** Qualificações do próprio colaborador logado — pro Meu Perfil. Um registro por tipo (o mais
 * recente), mesma lógica de dedup usada no perfil administrativo. */
export async function listMyQualifications(user: CurrentUser) {
  const collaborator = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!collaborator) return [];

  const records = await db.qualificationRecord.findMany({
    where: { collaboratorId: collaborator.id },
    include: { qualificationType: true, attachments: true },
    orderBy: { completedDate: "desc" },
  });

  const seenTypeIds = new Set<string>();
  return records.filter((r) => {
    if (seenTypeIds.has(r.qualificationTypeId)) return false;
    seenTypeIds.add(r.qualificationTypeId);
    return true;
  });
}

export type QualificationCertificateRef = { attachmentId: string; path: string; mimeType: string } | null;

export type CollaboratorQualificationSummary = {
  aso: { typeName: string; expiresAt: Date | null; certificate: QualificationCertificateRef } | null;
  nrs: { typeName: string; expiresAt: Date | null; certificate: QualificationCertificateRef }[];
  hasAnyRecord: boolean;
  hasAnyExpired: boolean;
  /** "Apto" olha só NR (o que o usuário pediu: sem nenhuma NR cadastrada, ou com alguma vencida,
   * é inapto — independe de ter ASO em dia ou não). */
  apt: boolean;
};

function latestCertificate(record: { attachments: { id: string; path: string; mimeType: string; uploadedAt: Date }[] }): QualificationCertificateRef {
  const latest = [...record.attachments].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
  return latest ? { attachmentId: latest.id, path: latest.path, mimeType: latest.mimeType } : null;
}

/** ASO/NR mais recente de cada tipo pro colaborador, e se ele está "apto" — usado no QR público
 * (individual e por área) e no perfil interno, pra manter a mesma regra nos dois lugares. */
export async function getCollaboratorQualificationSummary(collaboratorId: string): Promise<CollaboratorQualificationSummary> {
  const [records, collaborator] = await Promise.all([
    db.qualificationRecord.findMany({
      where: { collaboratorId },
      include: { qualificationType: true, attachments: true },
      orderBy: { completedDate: "desc" },
    }),
    db.collaborator.findUnique({ where: { id: collaboratorId }, select: { function: { select: { requiresNr: true } } } }),
  ]);

  const seenTypeIds = new Set<string>();
  const current = records.filter((r) => {
    if (seenTypeIds.has(r.qualificationTypeId)) return false;
    seenTypeIds.add(r.qualificationTypeId);
    return true;
  });

  const now = new Date();
  const hasAnyExpired = current.some((r) => r.expiresAt && r.expiresAt < now);
  const aso = current.find((r) => r.qualificationType.category === "ASO");
  const nrs = current.filter((r) => r.qualificationType.category === "NR");
  const hasAnyNrExpired = nrs.some((r) => r.expiresAt && r.expiresAt < now);
  // Sem função vinculada, assume que precisa (comportamento de sempre) — só desliga a cobrança
  // quando a função está explicitamente marcada como "não precisa de NR".
  const functionRequiresNr = collaborator?.function?.requiresNr !== false;

  return {
    aso: aso ? { typeName: aso.qualificationType.name, expiresAt: aso.expiresAt, certificate: latestCertificate(aso) } : null,
    nrs: nrs.map((r) => ({ typeName: r.qualificationType.name, expiresAt: r.expiresAt, certificate: latestCertificate(r) })),
    hasAnyRecord: current.length > 0,
    hasAnyExpired,
    apt: !functionRequiresNr || (nrs.length > 0 && !hasAnyNrExpired),
  };
}

async function listLatestRecordsPerPair() {
  const records = await db.qualificationRecord.findMany({
    include: { qualificationType: true, collaborator: true },
    orderBy: { completedDate: "desc" },
  });

  const latestByPair = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const key = `${record.collaboratorId}-${record.qualificationTypeId}`;
    if (!latestByPair.has(key)) {
      latestByPair.set(key, record);
    }
  }

  return Array.from(latestByPair.values());
}

/** Painel: colaboradores ativos, contagem por tipo (registro válido mais recente) e próximos vencimentos. */
export async function getQualificationDashboard(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const [activeCollaboratorsCount, types, latestRecords] = await Promise.all([
    db.collaborator.count({ where: { active: true } }),
    db.qualificationType.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    listLatestRecordsPerPair(),
  ]);

  const now = new Date();
  const validRecords = latestRecords.filter(
    (r) => r.collaborator.active && (!r.expiresAt || r.expiresAt >= now),
  );

  const countByType = new Map<string, number>();
  for (const record of validRecords) {
    countByType.set(record.qualificationTypeId, (countByType.get(record.qualificationTypeId) ?? 0) + 1);
  }

  const upcoming = validRecords
    .filter((r) => r.expiresAt)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())
    .slice(0, 15);

  return {
    activeCollaboratorsCount,
    types: types.map((type) => ({ ...type, activeCount: countByType.get(type.id) ?? 0 })),
    upcoming,
  };
}

/** NR/ASO/integração vencidas ou vencendo dentro da janela pedida — base do Rico pra responder
 * "o que tá vencendo nos próximos meses" sem precisar abrir o painel. Só olha o registro mais
 * recente de cada par colaborador+tipo (a mesma lógica do dashboard), pra não repetir uma NR já
 * renovada. */
export async function getExpiringQualifications(user: CurrentUser, withinDays: number = 90) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  const latestRecords = await listLatestRecordsPerPair();
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const relevant = latestRecords.filter((r) => r.collaborator.active && r.expiresAt && r.expiresAt <= horizon);

  const expired = relevant
    .filter((r) => r.expiresAt! < now)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());
  const expiringSoon = relevant
    .filter((r) => r.expiresAt! >= now)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());

  return { withinDays, expired, expiringSoon };
}

export type QualificationRecordFilters = {
  category?: QualificationCategory;
  qualificationTypeId?: string;
  status?: "valido" | "vencendo" | "vencido";
};

export async function listQualificationRecords(user: CurrentUser, filters: QualificationRecordFilters = {}) {
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const records = await db.qualificationRecord.findMany({
    where: {
      qualificationTypeId: filters.qualificationTypeId || undefined,
      qualificationType: filters.category ? { category: filters.category } : undefined,
    },
    include: { qualificationType: true, collaborator: true, attachments: true },
    orderBy: { completedDate: "desc" },
  });

  if (!filters.status) return records;

  const now = Date.now();
  return records.filter((record) => {
    if (!record.expiresAt) return filters.status === "valido";
    const daysLeft = Math.ceil((record.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
    if (filters.status === "vencido") return daysLeft < 0;
    if (filters.status === "vencendo") return daysLeft >= 0 && daysLeft <= 30;
    return daysLeft > 30;
  });
}
