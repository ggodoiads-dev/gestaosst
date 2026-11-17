import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { deleteStoredFile } from "@/server/services/storage";
import type { CurrentUser } from "@/server/auth/current-user";
import { canManageDiscipline } from "@/server/services/discipline.service";
import { ForbiddenError } from "@/server/auth/current-user";
import { DISCIPLINE_STEPS } from "@/domain/discipline/ladder";

function requireDiscipline(user: CurrentUser) {
  if (!canManageDiscipline(user)) throw new ForbiddenError();
}

export type DisciplineRecordItem = {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  reason: string;
  description: string;
  step: string;
  createdByName: string;
  createdAt: Date;
  files: { id: string; filename: string; path: string; uploadedByName: string; uploadedAt: Date }[];
};

/** Advertências registradas à mão, da mais recente para a mais antiga. Leitura tolerante: sem as tabelas no banco, devolve vazio e avisa que falta aplicar a atualização. */
export async function listDisciplineRecords(user: CurrentUser): Promise<{ ready: boolean; items: DisciplineRecordItem[] }> {
  requireDiscipline(user);
  try {
    const rows = await db.disciplineRecord.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 });
    const [people, files] = await Promise.all([
      db.collaborator.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.collaboratorId))] } }, select: { id: true, name: true } }),
      db.disciplineRecordFile.findMany({ where: { recordId: { in: rows.map((r) => r.id) } }, orderBy: { uploadedAt: "asc" } }),
    ]);
    const nameById = new Map(people.map((p) => [p.id, p.name]));
    return {
      ready: true,
      items: rows.map((r) => ({
        id: r.id,
        collaboratorId: r.collaboratorId,
        collaboratorName: nameById.get(r.collaboratorId) ?? "?",
        dayKey: r.date.toISOString().slice(0, 10),
        reason: r.reason,
        description: r.description,
        step: r.step,
        createdByName: r.createdByName,
        createdAt: r.createdAt,
        files: files.filter((f) => f.recordId === r.id).map((f) => ({ id: f.id, filename: f.filename, path: f.path, uploadedByName: f.uploadedByName, uploadedAt: f.uploadedAt })),
      })),
    };
  } catch (error) {
    console.error("[advertencias] registros manuais indisponíveis:", error);
    return { ready: false, items: [] };
  }
}

export type DisciplineRecordInput = { collaboratorId: string; dayKey: string; reason: string; description: string; step: string };

/** Registra uma advertência: motivo, descrição, data e a aplicação (medida da escada). Anexos podem vir depois. */
export async function createDisciplineRecord(user: CurrentUser, input: DisciplineRecordInput) {
  requireDiscipline(user);
  const reason = input.reason.trim();
  const description = input.description.trim();
  if (!input.collaboratorId) throw new Error("Escolha o colaborador.");
  if (reason.length < 3) throw new Error("Informe o motivo.");
  if (description.length < 3) throw new Error("Escreva a descrição.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) throw new Error("Data inválida.");
  if (!DISCIPLINE_STEPS.some((s) => s.key === input.step)) throw new Error("Escolha a aplicação.");
  await db.collaborator.findUniqueOrThrow({ where: { id: input.collaboratorId }, select: { id: true } });
  const created = await db.disciplineRecord.create({
    data: {
      collaboratorId: input.collaboratorId,
      date: new Date(`${input.dayKey}T12:00:00Z`),
      reason: reason.slice(0, 200),
      description: description.slice(0, 4000),
      step: input.step,
      createdById: user.id,
      createdByName: user.name,
    },
  });
  await recordAudit({ userId: user.id, action: "CREATE", entityType: "DisciplineRecord", entityId: created.id, newValue: { ...input } });
  return created;
}

/** Anexa um arquivo (ex.: a advertência assinada) a um registro. Pode ser feito a qualquer momento, quantas vezes precisar. */
export async function attachDisciplineRecordFile(user: CurrentUser, recordId: string, file: { filename: string; path: string; mimeType: string; size: number }) {
  requireDiscipline(user);
  await db.disciplineRecord.findUniqueOrThrow({ where: { id: recordId }, select: { id: true } });
  return db.disciplineRecordFile.create({
    data: { recordId, filename: file.filename, path: file.path, mimeType: file.mimeType, size: file.size, uploadedByName: user.name },
  });
}

export async function removeDisciplineRecordFile(user: CurrentUser, fileId: string) {
  requireDiscipline(user);
  const file = await db.disciplineRecordFile.findUnique({ where: { id: fileId } });
  if (!file) return;
  await db.disciplineRecordFile.delete({ where: { id: fileId } });
  await deleteStoredFile(file.path);
}

/** Apaga o registro e os anexos dele (para corrigir um lançamento errado). */
export async function deleteDisciplineRecord(user: CurrentUser, id: string) {
  requireDiscipline(user);
  const before = await db.disciplineRecord.findUnique({ where: { id } });
  if (!before) return;
  const files = await db.disciplineRecordFile.findMany({ where: { recordId: id } });
  await db.disciplineRecordFile.deleteMany({ where: { recordId: id } });
  await db.disciplineRecord.delete({ where: { id } });
  for (const f of files) await deleteStoredFile(f.path);
  await recordAudit({ userId: user.id, action: "CANCEL", entityType: "DisciplineRecord", entityId: id, previousValue: before });
}

/** Colaboradores ativos para escolher na nova advertência. */
export async function listCollaboratorsForDiscipline(user: CurrentUser) {
  requireDiscipline(user);
  return db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
