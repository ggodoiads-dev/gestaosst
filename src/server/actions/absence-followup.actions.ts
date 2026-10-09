"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { saveAttachmentUpload, InvalidUploadError } from "@/server/services/storage";
import * as service from "@/server/services/absence-followup.service";

export type FollowupResult = { ok: true } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<FollowupResult> {
  try {
    await fn();
    revalidatePath("/pendencias-advertencia");
    revalidatePath("/entrevistas-abs");
    revalidatePath("/escalas");
    revalidatePath("/presenca");
    revalidatePath("/minhas-advertencias");
    revalidatePath("/meu-perfil");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof InvalidUploadError) return { ok: false, error: error.message };
    if (error instanceof Error && /Só dá pra excluir|Advertência só se aplica|não é de uma falta|Escolha um arquivo|Arquivo|arquivo/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    console.error("[absence-followup] falha:", error);
    return { ok: false, error: "Não foi possível concluir. Tente de novo." };
  }
}

export async function deleteAbsenceNoteAction(noteId: string) {
  return run(async () => {
    const user = await requireUser();
    await service.deleteAbsenceNote(user, noteId);
  });
}

export async function attachWarningDocumentAction(noteId: string, formData: FormData) {
  return run(async () => {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Escolha um arquivo.");
    const saved = await saveAttachmentUpload(file);
    await service.attachWarningDocument(user, noteId, saved);
  });
}

export async function removeWarningDocumentAction(attachmentId: string) {
  return run(async () => {
    const user = await requireUser();
    await service.removeWarningDocument(user, attachmentId);
  });
}
