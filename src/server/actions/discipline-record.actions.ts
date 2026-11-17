"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { InvalidUploadError, saveAttachmentUpload } from "@/server/services/storage";
import {
  attachDisciplineRecordFile,
  createDisciplineRecord,
  deleteDisciplineRecord,
  removeDisciplineRecordFile,
  type DisciplineRecordInput,
} from "@/server/services/discipline-record.service";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const GENERIC = "Não foi possível salvar. Se a atualização do banco de dados das advertências ainda não foi feita, ela precisa ser aplicada primeiro.";

async function run(fn: () => Promise<{ id: string } | void>): Promise<Result> {
  try {
    const created = await fn();
    revalidatePath("/pendencias-advertencia");
    return { ok: true, id: created ? created.id : undefined };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof InvalidUploadError) return { ok: false, error: error.message };
    if (error instanceof Error && /Escolha|Informe|Escreva|inválida/.test(error.message)) return { ok: false, error: error.message };
    console.error("[advertencias] falha:", error);
    return { ok: false, error: GENERIC };
  }
}

export async function createDisciplineRecordAction(input: DisciplineRecordInput) {
  return run(async () => createDisciplineRecord(await requireUser(), input));
}

export async function attachDisciplineRecordFileAction(recordId: string, formData: FormData) {
  return run(async () => {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Escolha um arquivo.");
    const saved = await saveAttachmentUpload(file);
    await attachDisciplineRecordFile(user, recordId, saved);
  });
}

export async function removeDisciplineRecordFileAction(fileId: string) {
  return run(async () => removeDisciplineRecordFile(await requireUser(), fileId));
}

export async function deleteDisciplineRecordAction(id: string) {
  return run(async () => deleteDisciplineRecord(await requireUser(), id));
}
