"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/exit-survey.service";
import type { ParsedSurvey } from "@/domain/termination/survey";

export type ReadSurveyResult = { ok: true; survey: ParsedSurvey } | { ok: false; error: string };

export async function readSurveyFileAction(formData: FormData): Promise<ReadSurveyResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    const res = await service.readSurveyFile(user, Buffer.from(await file.arrayBuffer()), file.name);
    return "error" in res ? { ok: false, error: res.error } : { ok: true, survey: res };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[exit-survey] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type SaveSurveyResult = { ok: true } | { ok: false; error: string };

export async function saveSurveyAction(survey: ParsedSurvey, periodLabel: string): Promise<SaveSurveyResult> {
  try {
    const user = await requireUser();
    await service.saveExitSurvey(user, survey, periodLabel);
    revalidatePath("/desligamentos/pdca");
    revalidatePath("/desligamentos/entrevistas/resumo");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[exit-survey] falha ao salvar:", error);
    return { ok: false, error: "Não foi possível salvar. Se a tabela do resumo ainda não foi criada, rode a criação antes." };
  }
}

export async function clearSurveyAction(kind: "MOTIVOS_TEMPO" | "SATISFACAO"): Promise<SaveSurveyResult> {
  try {
    const user = await requireUser();
    await service.clearExitSurvey(user, kind);
    revalidatePath("/desligamentos/pdca");
    revalidatePath("/desligamentos/entrevistas/resumo");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[exit-survey] falha ao remover:", error);
    return { ok: false, error: "Não foi possível remover." };
  }
}
