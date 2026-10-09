import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { deleteStoredFile } from "@/server/services/storage";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

/** Tratativa de faltas/atestados pelo RH: excluir lançamento errado e anexar o documento da advertência. */

async function noteWithFiles(noteId: string) {
  return db.scheduleDayNote.findUniqueOrThrow({
    where: { id: noteId },
    include: { attachments: { select: { id: true, path: true } } },
  });
}

/** Exclui um lançamento de falta/atestado feito por engano: a falta some da escala, da presença e da fila de
 * pendências, e o dia volta ao que a escala do colaborador determina. Apaga junto os anexos e a entrevista. */
export async function deleteAbsenceNote(user: CurrentUser, noteId: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const note = await noteWithFiles(noteId);
  if (note.status !== "FALTA" && note.status !== "ATESTADO") {
    throw new Error("Só dá pra excluir por aqui lançamentos de falta ou atestado.");
  }

  await db.$transaction([
    db.attachment.deleteMany({ where: { scheduleDayNoteId: noteId } }),
    db.scheduleDayNote.delete({ where: { id: noteId } }), // a entrevista de ABS vai junto (cascade)
  ]);
  await Promise.all(note.attachments.map((a) => deleteStoredFile(a.path)));
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "ScheduleDayNote",
    entityId: noteId,
    previousValue: {
      collaboratorId: note.collaboratorId,
      date: note.date,
      status: note.status,
      notes: note.notes,
      reason: "Lançamento excluído pela fila de pendências",
    },
  });
}

/** Anexa o documento da advertência (ex: advertência assinada) a uma falta e já marca a advertência como aplicada. */
export async function attachWarningDocument(
  user: CurrentUser,
  noteId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const note = await db.scheduleDayNote.findUniqueOrThrow({ where: { id: noteId } });
  if (note.status !== "FALTA") throw new Error("Advertência só se aplica a falta (atestado médico não gera advertência).");

  const [attachment] = await db.$transaction([
    db.attachment.create({
      data: {
        filename: file.filename,
        path: file.path,
        mimeType: file.mimeType,
        size: file.size,
        context: "ESCALA",
        scheduleDayNoteId: noteId,
        uploadedById: user.id,
      },
    }),
    db.scheduleDayNote.update({ where: { id: noteId }, data: { warningApplied: true } }),
  ]);
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "Attachment",
    entityId: attachment.id,
    newValue: { noteId, filename: file.filename, kind: "documento de advertência" },
  });
  return attachment;
}

export async function removeWarningDocument(user: CurrentUser, attachmentId: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const attachment = await db.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
  if (!attachment.scheduleDayNoteId) throw new Error("Este anexo não é de uma falta.");
  await db.attachment.delete({ where: { id: attachmentId } });
  await deleteStoredFile(attachment.path);
  await recordAudit({
    userId: user.id,
    action: "DELETE",
    entityType: "Attachment",
    entityId: attachmentId,
    previousValue: { noteId: attachment.scheduleDayNoteId, filename: attachment.filename },
  });
}

/** Documentos de advertência anexados às faltas do próprio colaborador (ele vê o que o RH anexou). */
export async function listMyWarningDocuments(user: CurrentUser) {
  const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!own) return [];
  const notes = await db.scheduleDayNote.findMany({
    where: { collaboratorId: own.id, status: "FALTA", attachments: { some: {} } },
    select: {
      id: true,
      date: true,
      attachments: { select: { id: true, filename: true, path: true, uploadedAt: true }, orderBy: { uploadedAt: "desc" } },
    },
    orderBy: { date: "desc" },
  });
  return notes;
}
