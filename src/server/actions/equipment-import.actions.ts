"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as equipmentImportService from "@/server/services/equipment-import.service";
import type { EquipmentImportMapping, EquipmentImportRowResult } from "@/server/services/equipment-import.service";

export type UploadResult =
  | { ok: true; headers: string[]; rows: string[][]; suggestedMapping: EquipmentImportMapping }
  | { ok: false; error: string };

export async function uploadEquipmentSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido (.xlsx ou .csv)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await equipmentImportService.parseSpreadsheet(buffer, file.name);
    if (headers.length === 0) {
      return { ok: false, error: "Não consegui ler nenhuma coluna nesse arquivo." };
    }

    const suggestedMapping = equipmentImportService.suggestMapping(headers);
    return { ok: true, headers, rows, suggestedMapping };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[equipment-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type PreviewResult = { ok: true; rows: EquipmentImportRowResult[] } | { ok: false; error: string };

export async function previewEquipmentImportAction(
  rows: string[][],
  mapping: EquipmentImportMapping,
): Promise<PreviewResult> {
  try {
    const user = await requireUser();
    const preview = await equipmentImportService.buildEquipmentImportPreview(user, rows, mapping);
    return { ok: true, rows: preview };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[equipment-import] falha ao montar preview:", error);
    return { ok: false, error: "Não foi possível montar o preview." };
  }
}

export type CommitResult =
  | { ok: true; created: number; updated: number; errors: number }
  | { ok: false; error: string };

export async function commitEquipmentImportAction(rows: EquipmentImportRowResult[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await equipmentImportService.commitEquipmentImport(user, rows);
    revalidatePath("/cadastros/equipamentos");
    revalidatePath("/equipamentos");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[equipment-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
