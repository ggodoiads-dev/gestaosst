"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as executionService from "@/server/services/checklist-execution.service";
import { savePhotoUpload, readFileBuffer, InvalidUploadError } from "@/server/services/storage";
import { analyzePhotoFinding, saveAiInspectionFinding, type PhotoFinding } from "@/server/services/ai-vision.service";

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

export type UploadPhotoResult =
  | { ok: true; finding: PhotoFinding | null }
  | { ok: false; error: string };

/**
 * Além de salvar a foto, dispara o Copiloto de Inspeção (análise por visão
 * computacional) de forma best-effort — se falhar ou a IA não estiver configurada
 * (`ANTHROPIC_API_KEY`), o upload continua valendo normalmente, só sem o achado.
 */
export async function uploadAnswerPhotoAction(
  executionId: string,
  questionId: string,
  questionTitle: string,
  formData: FormData,
): Promise<UploadPhotoResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione uma foto válida." };
    }
    const saved = await savePhotoUpload(file);
    const { attachment, answerComment } = await executionService.attachAnswerPhoto(
      executionId,
      questionId,
      saved,
      user.id,
    );

    let finding: PhotoFinding | null = null;
    try {
      const imageBuffer = await readFileBuffer(saved.path);
      finding = await analyzePhotoFinding({
        imageBuffer,
        mimeType: saved.mimeType,
        questionTitle,
        answerComment,
      });
      if (finding) await saveAiInspectionFinding(attachment.id, finding);
    } catch (error) {
      console.error("[uploadAnswerPhotoAction] copiloto de inspeção falhou:", error);
    }

    return { ok: true, finding };
  } catch (error) {
    if (error instanceof InvalidUploadError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível enviar a foto." };
  }
}

export type FinalizeExecutionResult =
  | { ok: true; blockedMessage: string | null }
  | { ok: false; kind: "issues"; issues: { questionId: string; questionTitle: string; reason: string }[] }
  | { ok: false; kind: "error"; error: string };

/**
 * Sem esse try/catch, qualquer erro do serviço (ex: `ForbiddenError` de "já foi finalizado" —
 * comum quando a resposta de uma tentativa anterior nunca chegou de volta numa conexão ruim e o
 * colaborador tenta de novo) atravessava a Server Action sem tratamento: o Next.js devolve isso
 * como uma rejeição genérica pro cliente, que o React 19 propaga pro Error Boundary da página em
 * vez de deixar o `try/catch` do próprio formulário mostrar um toast — o checklist preenchido
 * "sumia" atrás de uma tela de erro. Em dado móvel (mais latência, mais chance de retry) isso
 * era muito mais visível do que no wifi.
 */
export async function finalizeExecutionAction(
  equipmentId: string,
  executionId: string,
  answers: { questionId: string; value: string | null; comment: string | null }[],
): Promise<FinalizeExecutionResult> {
  const user = await requireUser();
  try {
    const result = await executionService.finalizeExecution(user, executionId, answers);
    if (!result.ok) return { ok: false, kind: "issues", issues: result.issues };
    revalidatePath("/checklist/realizar");
    revalidatePath(`/equipamentos/${equipmentId}`);
    revalidatePath("/inicio");
    revalidatePath("/equipamentos/painel");
    revalidatePath("/meu-historico");
    return result;
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, kind: "error", error: error.message };
    console.error(error);
    return {
      ok: false,
      kind: "error",
      error: "Não foi possível finalizar o checklist. Verifique sua conexão e tente novamente.",
    };
  }
}

export async function invalidateExecutionAction(executionId: string, reason: string) {
  const user = await requireUser();
  await executionService.invalidateExecution(user, executionId, reason);
  revalidatePath("/meu-historico");
  revalidatePath("/historico");
}
