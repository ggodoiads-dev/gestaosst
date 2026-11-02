"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { savePdca, type PdcaData } from "@/server/services/pdca.service";

export async function savePdcaAction(year: number, data: PdcaData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await savePdca(user, year, data);
    revalidatePath("/desligamentos/pdca");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "Ano inválido.") return { ok: false, error: error.message };
    console.error("[pdca] falha ao salvar:", error);
    return { ok: false, error: "Não foi possível salvar. A tabela do PDCA já foi criada no banco?" };
  }
}
