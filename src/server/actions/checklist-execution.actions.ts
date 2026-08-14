"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as executionService from "@/server/services/checklist-execution.service";
import { savePhotoUpload, InvalidUploadError } from "@/server/services/storage";

export type SaveAnswerResult = { ok: true } | { ok: false; error: string };

export async function saveAnswerAction(
  executionId: string,
  questionId: string,
  value: string | null,
  comment: string | null,
): Promise<SaveAnswerResult> {
  try {
    const user = await requireUser();
    await executionService.saveAnswer(user, executionId, { questionId, value, comment });
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível salvar a resposta." };
  }
}

export async function uploadAnswerPhotoAction(
  executionId: string,
  questionId: string,
  formData: FormData,
): Promise<SaveAnswerResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione uma foto válida." };
    }
    const saved = await savePhotoUpload(file);
    await executionService.attachAnswerPhoto(executionId, questionId, saved, user.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidUploadError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível enviar a foto." };
  }
}

export type FinalizeExecutionResult =
  | { ok: true }
  | { ok: false; issues: { questionId: string; questionTitle: string; reason: string }[] };

export async function finalizeExecutionAction(
  equipmentId: string,
  executionId: string,
  answers: { questionId: string; value: string | null; comment: string | null }[],
): Promise<FinalizeExecutionResult> {
  const user = await requireUser();
  const result = await executionService.finalizeExecution(user, executionId, answers);
  if (result.ok) {
    revalidatePath("/checklist/realizar");
    revalidatePath(`/equipamentos/${equipmentId}`);
    revalidatePath("/inicio");
    revalidatePath("/equipamentos/painel");
    revalidatePath("/meu-historico");
  }
  return result;
}

export async function invalidateExecutionAction(executionId: string, reason: string) {
  const user = await requireUser();
  await executionService.invalidateExecution(user, executionId, reason);
  revalidatePath("/meu-historico");
  revalidatePath("/historico");
}
