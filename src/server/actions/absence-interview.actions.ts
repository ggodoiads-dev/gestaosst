"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/absence-interview.service";

export type InterviewActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function run(fn: () => Promise<{ id?: string } | void>): Promise<InterviewActionResult> {
  try {
    const result = await fn();
    revalidatePath("/pendencias-advertencia");
    revalidatePath("/entrevistas-abs");
    revalidatePath("/minhas-entrevistas");
    return { ok: true, id: result?.id };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    if (error instanceof Error && /Falta o relato|já foi concluída|Só falta ou atestado/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    console.error("[absence-interview] falha:", error);
    return { ok: false, error: "Não foi possível concluir a operação. Tente de novo." };
  }
}

export async function requestAbsenceInterviewAction(noteId: string) {
  return run(async () => {
    const user = await requireUser();
    const created = await service.requestInterview(user, noteId);
    return { id: created.id };
  });
}

export async function submitAbsenceInterviewAnswersAction(id: string, answers: unknown) {
  return run(async () => {
    const user = await requireUser();
    await service.submitAnswers(user, id, answers);
  });
}

export async function concludeAbsenceInterviewAction(id: string, evaluation: unknown) {
  return run(async () => {
    const user = await requireUser();
    await service.concludeInterview(user, id, evaluation);
  });
}

export async function reopenAbsenceInterviewAction(id: string) {
  return run(async () => {
    const user = await requireUser();
    await service.reopenInterview(user, id);
  });
}
