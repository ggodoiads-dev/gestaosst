"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as qualificationImportService from "@/server/services/qualification-import.service";
import type {
  QualificationImportMapping,
  QualificationImportRowResult,
} from "@/server/services/qualification-import.service";

export type UploadResult =
  | { ok: true; headers: string[]; rows: string[][]; suggestedMapping: QualificationImportMapping }
  | { ok: false; error: string };

export async function uploadQualificationSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await qualificationImportService.parseSpreadsheet(buffer, file.name);
    if (headers.length === 0) {
      return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
    }

    const suggestedMapping = qualificationImportService.suggestMapping(headers);
    return { ok: true, headers, rows, suggestedMapping };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[qualification-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult =
  | { ok: true; rows: QualificationImportRowResult[] }
  | { ok: false; error: string };

export async function previewQualificationImportAction(
  rows: string[][],
  mapping: QualificationImportMapping,
): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    const preview = await qualificationImportService.buildQualificationImportPreview(user, rows, mapping);
    return { ok: true, rows: preview };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[qualification-import] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult =
  | { ok: true; created: number; duplicates: number; errors: number }
  | { ok: false; error: string };

export async function commitQualificationImportAction(
  rows: QualificationImportRowResult[],
): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await qualificationImportService.commitQualificationImport(user, rows);
    revalidatePath("/qualificacoes");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[qualification-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
