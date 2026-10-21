"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as dreService from "@/server/services/dre.service";
import type { DrePreview } from "@/server/services/dre.service";

export type DrePreviewResult = { ok: true; preview: DrePreview } | { ok: false; error: string };

export async function previewDreAction(formData: FormData): Promise<DrePreviewResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione o arquivo do DRE (.xlsx) exportado da plataforma financeira." };
    const preview = await dreService.previewDre(user, Buffer.from(await file.arrayBuffer()));
    if (preview.months.length === 0) return { ok: false, error: preview.warnings[0] ?? "Não encontrei meses do DRE nesse arquivo." };
    return { ok: true, preview };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dre] falha ao ler arquivo:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Use o export original do DRE (.xlsx)." };
  }
}

export type DreCommitResult = { ok: true; months: number } | { ok: false; error: string };

/** Recebe o MESMO arquivo da prévia e refaz a leitura no servidor. */
export async function commitDreAction(formData: FormData): Promise<DreCommitResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Arquivo não encontrado. Envie de novo." };
    const { months } = await dreService.commitDre(user, Buffer.from(await file.arrayBuffer()), file.name);
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/dre");
    revalidatePath("/cascata");
    return { ok: true, months };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dre] falha ao importar:", error);
    return { ok: false, error: "Não foi possível concluir a importação. Tente de novo." };
  }
}
