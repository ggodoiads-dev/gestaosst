"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as service from "@/server/services/exit-interview-import.service";
import type { InterviewImportMapping, InterviewImportRow } from "@/server/services/exit-interview-import.service";

export type UploadResult = { ok: true; headers: string[]; rows: string[][]; suggestedMapping: InterviewImportMapping } | { ok: false; error: string };

export async function uploadInterviewSpreadsheetAction(formData: FormData): Promise<UploadResult> {
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
    console.error("[exit-interview-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult = { ok: true; rows: InterviewImportRow[] } | { ok: false; error: string };

export async function previewInterviewImportAction(rows: string[][], mapping: InterviewImportMapping): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    return { ok: true, rows: await service.buildInterviewImportPreview(user, rows, mapping) };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[exit-interview-import] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult = { ok: true; created: number; updated: number; skipped: number; errors: number } | { ok: false; error: string };

export async function commitInterviewImportAction(rows: InterviewImportRow[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await service.commitInterviewImport(user, rows);
    revalidatePath("/desligamentos");
    revalidatePath("/desligamentos/pdca");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[exit-interview-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
