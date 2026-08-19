"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as accidentImportService from "@/server/services/accident-import.service";
import type { AccidentImportMapping, AccidentImportRowResult } from "@/server/services/accident-import.service";

export type UploadResult =
  | { ok: true; headers: string[]; rows: string[][]; suggestedMapping: AccidentImportMapping }
  | { ok: false; error: string };

export async function uploadAccidentSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await accidentImportService.parseSpreadsheet(buffer, file.name);
    if (headers.length === 0) {
      return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
    }

    const suggestedMapping = accidentImportService.suggestMapping(headers);
    return { ok: true, headers, rows, suggestedMapping };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[accident-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult = { ok: true; rows: AccidentImportRowResult[] } | { ok: false; error: string };

export async function previewAccidentImportAction(
  rows: string[][],
  mapping: AccidentImportMapping,
): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    const preview = await accidentImportService.buildAccidentImportPreview(user, rows, mapping);
    return { ok: true, rows: preview };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[accident-import] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult =
  | { ok: true; created: number; errors: number }
  | { ok: false; error: string };

export async function commitAccidentImportAction(rows: AccidentImportRowResult[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await accidentImportService.commitAccidentImport(user, rows);
    revalidatePath("/acidentes");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[accident-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
