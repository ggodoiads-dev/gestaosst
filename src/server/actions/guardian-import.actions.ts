"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import * as guardianImportService from "@/server/services/guardian-import.service";
import type { GuardianImportRow } from "@/server/services/guardian-import.service";

export type UploadResult = { ok: true; rows: GuardianImportRow[] } | { ok: false; error: string };

export async function uploadGuardianSpreadsheetAction(formData: FormData): Promise<UploadResult> {
  try {
    const user = await requireUser();
    requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione o arquivo exportado do Guardian (.xlsx)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawRows = await guardianImportService.parseGuardianWorkbook(buffer);
    if (rawRows.length === 0) {
      return { ok: false, error: "Não encontrei nenhuma aba conhecida (comportamento_risco, condicao, incidente, reconhecimento) nesse arquivo." };
    }

    const rows = await guardianImportService.buildGuardianImportPreview(user, rawRows);
    return { ok: true, rows };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[guardian-import] falha ao ler planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique se é o export original do Guardian." };
  }
}

export type CommitResult = { ok: true; created: number; skipped: number } | { ok: false; error: string };

export async function commitGuardianImportAction(rows: GuardianImportRow[]): Promise<CommitResult> {
  try {
    const user = await requireUser();
    const result = await guardianImportService.commitGuardianImport(user, rows);
    revalidatePath("/guardian");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[guardian-import] falha ao confirmar importação:", error);
    return { ok: false, error: "Não foi possível concluir a importação." };
  }
}
