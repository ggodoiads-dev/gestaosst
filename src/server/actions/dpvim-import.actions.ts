"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { commitDpvimImport, previewDpvimImport, type DpvimImportRow } from "@/server/services/dpvim-import.service";

export type DpvimPreviewResult = { ok: true; rows: DpvimImportRow[] } | { ok: false; error: string };
export type DpvimCommitResult = { ok: true; created: number; skipped: number; errors: number; failed: string[] } | { ok: false; error: string };

async function readFile(formData: FormData): Promise<{ buffer: Buffer; name: string } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}

/** Lê a planilha e mostra o que vai ser criado, sem gravar nada. */
export async function previewDpvimImportAction(formData: FormData): Promise<DpvimPreviewResult> {
  try {
    const user = await requireUser();
    const file = await readFile(formData);
    if (!file) return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    const plan = await previewDpvimImport(user, file.buffer, file.name);
    return plan.ok ? { ok: true, rows: plan.rows } : { ok: false, error: plan.error };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dpvim-import] falha ao ler a planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

/** Cria as DPVIM da planilha (as já importadas ficam de fora). */
export async function commitDpvimImportAction(formData: FormData): Promise<DpvimCommitResult> {
  try {
    const user = await requireUser();
    const file = await readFile(formData);
    if (!file) return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    const result = await commitDpvimImport(user, file.buffer, file.name);
    revalidatePath("/dpvim");
    revalidatePath("/dpvim/fornecedores");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dpvim-import] falha ao importar:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
