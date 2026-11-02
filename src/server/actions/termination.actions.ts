"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as service from "@/server/services/termination.service";
import type { TerminationImportMapping, TerminationImportRow } from "@/server/services/termination.service";

export type UploadResult = { ok: true; headers: string[]; rows: string[][]; suggestedMapping: TerminationImportMapping } | { ok: false; error: string };

export async function uploadTerminationSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.HR_MANAGE);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    const { headers, rows } = await service.parseSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
    if (headers.length === 0) return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
    return { ok: true, headers, rows, suggestedMapping: service.suggestMapping(headers) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[termination] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult = { ok: true; rows: TerminationImportRow[] } | { ok: false; error: string };

export async function previewTerminationImportAction(rows: string[][], mapping: TerminationImportMapping): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    return { ok: true, rows: await service.buildTerminationImportPreview(user, rows, mapping) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[termination] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult = { ok: true; created: number; skipped: number; errors: number } | { ok: false; error: string };

export async function commitTerminationImportAction(rows: TerminationImportRow[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await service.commitTerminationImport(user, rows);
    revalidatePath("/desligamentos");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[termination] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação. A tabela de desligamentos já foi criada no banco?" };
  }
}

export async function deleteTerminationAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await service.deleteTermination(user, id);
    revalidatePath("/desligamentos");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[termination] falha ao excluir:", error);
    return { ok: false, error: "Não foi possível excluir." };
  }
}
