"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { getExitInterview, saveExitInterview, saveHeadcountBase, type ExitInterviewData } from "@/server/services/exit-interview.service";

type Result = { ok: true } | { ok: false; error: string };

const KNOWN = /Escolha o motivo|Informe a data|não encontrado/;

export async function loadExitInterviewAction(terminationId: string): Promise<ExitInterviewData | null> {
  const user = await requireUser();
  return getExitInterview(user, terminationId);
}

export async function saveExitInterviewAction(terminationId: string, data: ExitInterviewData): Promise<Result> {
  try {
    const user = await requireUser();
    await saveExitInterview(user, terminationId, data);
    revalidatePath("/desligamentos");
    revalidatePath("/desligamentos/pdca");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[exit-interview] falha ao salvar:", error);
    return { ok: false, error: "Não foi possível salvar a entrevista. A tabela já foi criada no banco?" };
  }
}

export async function saveHeadcountBaseAction(entries: { month: string; headcount: number | null }[]): Promise<Result> {
  try {
    const user = await requireUser();
    await saveHeadcountBase(user, entries);
    revalidatePath("/desligamentos/pdca");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[turnover] falha ao salvar a base de efetivo:", error);
    return { ok: false, error: "Não foi possível salvar o efetivo. A tabela já foi criada no banco?" };
  }
}
