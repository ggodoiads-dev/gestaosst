"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as tmaService from "@/server/services/tma.service";
import type { TmaRowInput } from "@/domain/tma/parse";

export type TmaImportResult = { ok: true; rows: number } | { ok: false; error: string };

/** Recebe UM mês já lido no navegador (a planilha passa de 5 MB, então o arquivo nunca sobe inteiro). */
export async function importTmaMonthAction(input: { periodKey: string; fileName: string; rows: TmaRowInput[] }): Promise<TmaImportResult> {
  try {
    const user = await requireUser();
    const { rows } = await tmaService.importTmaMonth(user, input);
    revalidatePath("/tma");
    revalidatePath("/cascata");
    return { ok: true, rows };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Mês inválido|não tem caminhões|linhas demais|Nenhuma linha válida/.test(error.message)) return { ok: false, error: error.message };
    console.error("[tma] falha ao importar:", error);
    return { ok: false, error: "Não foi possível importar este mês. Tente de novo." };
  }
}
