"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as dtoService from "@/server/services/dto.service";
import type { DtoImportRow } from "@/server/services/dto.service";

export type DtoUploadResult = { ok: true; rows: DtoImportRow[] } | { ok: false; error: string };

export async function uploadDtoSpreadsheetAction(formData: FormData): Promise<DtoUploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.DTO_MANAGE);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione a planilha exportada do DMPeople (.xlsx)." };

    const raw = dtoService.parseDtoSpreadsheet(Buffer.from(await file.arrayBuffer()));
    if (raw.length === 0) {
      return { ok: false, error: "Não encontrei avaliações nesse arquivo. Use o relatório detalhado de DTO exportado do DMPeople." };
    }
    return { ok: true, rows: await dtoService.buildDtoImportPreview(user, raw) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dto-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique se é o export original do DMPeople." };
  }
}

export type DtoCommitResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

export async function commitDtoImportAction(rows: DtoImportRow[]): Promise<DtoCommitResult> {
  try {
    const user = await requireUser();
    const result = await dtoService.commitDtoImport(user, rows);
    revalidatePath("/dto");
    revalidatePath("/meu-perfil");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dto-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}

export type DtoJustifyResult = { ok: true } | { ok: false; error: string };

export async function justifyDtoAction(input: { collaboratorId: string; dayKey: string; note: string | null }): Promise<DtoJustifyResult> {
  try {
    const user = await requireUser();
    await dtoService.justifyDto(user, input);
    revalidatePath("/dto");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Data inválida|futuro/.test(error.message)) return { ok: false, error: error.message };
    console.error("[dto] falha ao justificar:", error);
    return { ok: false, error: "Não foi possível salvar a justificativa. Tente de novo." };
  }
}

export async function removeDtoJustificationAction(id: string): Promise<DtoJustifyResult> {
  try {
    const user = await requireUser();
    await dtoService.removeDtoJustification(user, id);
    revalidatePath("/dto");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[dto] falha ao desfazer justificativa:", error);
    return { ok: false, error: "Não foi possível desfazer. Tente de novo." };
  }
}
