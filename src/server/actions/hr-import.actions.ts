"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as hrImportService from "@/server/services/hr-import.service";
import type { ImportMapping, ImportRowResult } from "@/server/services/hr-import.service";

export type UploadResult =
  | { ok: true; headers: string[]; rows: string[][]; suggestedMapping: ImportMapping }
  | { ok: false; error: string };

export async function uploadSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.HR_MANAGE);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await hrImportService.parseSpreadsheet(buffer, file.name);
    if (headers.length === 0) {
      return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
    }

    const suggestedMapping = hrImportService.suggestMapping(headers);
    return { ok: true, headers, rows, suggestedMapping };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[hr-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult = { ok: true; rows: ImportRowResult[] } | { ok: false; error: string };

export async function previewImportAction(rows: string[][], mapping: ImportMapping): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    const preview = await hrImportService.buildImportPreview(user, rows, mapping);
    return { ok: true, rows: preview };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[hr-import] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult =
  | { ok: true; created: number; updated: number; errors: number }
  | { ok: false; error: string };

export async function commitImportAction(rows: ImportRowResult[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await hrImportService.commitImport(user, rows);
    revalidatePath("/rh");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[hr-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
