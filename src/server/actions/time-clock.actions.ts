"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as timeClockService from "@/server/services/time-clock.service";
import type { TimeClockAnomaly, TimeClockImportSummary } from "@/server/services/time-clock.service";
import { parseDateOnly } from "@/lib/dates";

export type UploadAfdtResult = { ok: true; summary: TimeClockImportSummary } | { ok: false; error: string };

export async function uploadAfdtAction(formData: FormData): Promise<UploadAfdtResult> {
  try {
    const user = await requireUser();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo AFDT válido (.txt)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await timeClockService.importTimeClockFile(user, buffer);
    if (summary.totalRecords === 0) {
      return { ok: false, error: "Não encontrei nenhuma marcação de ponto nesse arquivo." };
    }

    revalidatePath("/rh/ponto");
    return { ok: true, summary };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao importar AFDT:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Verifique o formato." };
  }
}

export type GetReportResult = { ok: true; anomalies: TimeClockAnomaly[] } | { ok: false; error: string };

export async function getTimeClockReportAction(fromIso: string, toIso: string): Promise<GetReportResult> {
  try {
    const user = await requireUser();
    const anomalies = await timeClockService.getTimeClockReport(user, {
      from: parseDateOnly(fromIso),
      to: parseDateOnly(toIso),
    });
    return { ok: true, anomalies };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao montar relatório:", error);
    return { ok: false, error: "Não foi possível montar o relatório." };
  }
}
