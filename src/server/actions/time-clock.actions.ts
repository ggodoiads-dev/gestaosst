"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as timeClockService from "@/server/services/time-clock.service";
import { InvalidTimeClockFileError } from "@/server/services/time-clock.service";
import type {
  TimeClockAnomaly,
  TimeClockImportSummary,
  ChecklistAdherenceReport,
  UnmatchedTimeClockPis,
} from "@/server/services/time-clock.service";
import type { ChecklistJustificationReason } from "@/domain/time-clock/checklist-justification-reasons";
import { parseDateOnly } from "@/lib/dates";

export type UploadAfdtResult = { ok: true; summary: TimeClockImportSummary } | { ok: false; error: string };

export async function uploadAfdtAction(formData: FormData): Promise<UploadAfdtResult> {
  try {
    const user = await requireUser();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido (.txt do AFD ou .zip do AEJ)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await timeClockService.importTimeClockFile(user, buffer, file.name);
    if (summary.totalRecords === 0) {
      return { ok: false, error: "Não encontrei nenhuma marcação de ponto nesse arquivo." };
    }

    revalidatePath("/rh/ponto");
    return { ok: true, summary };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof InvalidTimeClockFileError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao importar arquivo de ponto:", error);
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

export type GetAdherenceResult = { ok: true; report: ChecklistAdherenceReport } | { ok: false; error: string };

export async function getChecklistAdherenceAction(fromIso: string, toIso: string): Promise<GetAdherenceResult> {
  try {
    const user = await requireUser();
    const report = await timeClockService.getChecklistAdherence(user, {
      from: parseDateOnly(fromIso),
      to: parseDateOnly(toIso),
    });
    return { ok: true, report };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao montar aderência de checklist:", error);
    return { ok: false, error: "Não foi possível montar a aderência." };
  }
}

export type GetUnmatchedPisResult = { ok: true; items: UnmatchedTimeClockPis[] } | { ok: false; error: string };

export async function getUnmatchedTimeClockPisAction(): Promise<GetUnmatchedPisResult> {
  try {
    const user = await requireUser();
    const items = await timeClockService.listUnmatchedTimeClockPis(user);
    return { ok: true, items };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao listar códigos não identificados:", error);
    return { ok: false, error: "Não foi possível listar os códigos não identificados." };
  }
}

export type LinkPisResult = { ok: true; linkedRecords: number } | { ok: false; error: string };

export async function linkTimeClockPisAction(pis: string, collaboratorId: string): Promise<LinkPisResult> {
  try {
    const user = await requireUser();
    const result = await timeClockService.linkTimeClockPisToCollaborator(user, pis, collaboratorId);
    revalidatePath("/rh/ponto");
    return { ok: true, linkedRecords: result.linkedRecords };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao vincular código ao colaborador:", error);
    return { ok: false, error: "Não foi possível vincular esse código." };
  }
}

export type IgnorePisResult = { ok: true } | { ok: false; error: string };

export async function ignoreTimeClockPisAction(pis: string): Promise<IgnorePisResult> {
  try {
    const user = await requireUser();
    await timeClockService.ignoreTimeClockPis(user, pis);
    revalidatePath("/rh/ponto");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao ignorar código:", error);
    return { ok: false, error: "Não foi possível ignorar esse código." };
  }
}

export type IgnoreAllPisResult = { ok: true; ignoredCount: number } | { ok: false; error: string };

export async function ignoreAllUnmatchedTimeClockPisAction(): Promise<IgnoreAllPisResult> {
  try {
    const user = await requireUser();
    const result = await timeClockService.ignoreAllUnmatchedTimeClockPis(user);
    revalidatePath("/rh/ponto");
    return { ok: true, ignoredCount: result.ignoredCount };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao ignorar todos os códigos:", error);
    return { ok: false, error: "Não foi possível ignorar os códigos." };
  }
}

export type JustifyResult = { ok: true } | { ok: false; error: string };

export async function justifyChecklistPendingAction(input: {
  collaboratorId: string;
  date: string;
  reason: ChecklistJustificationReason;
  note: string | null;
}): Promise<JustifyResult> {
  try {
    const user = await requireUser();
    await timeClockService.justifyChecklistPending(user, {
      collaboratorId: input.collaboratorId,
      date: parseDateOnly(input.date),
      reason: input.reason,
      note: input.note?.trim() || null,
    });
    revalidatePath("/rh/ponto");
    revalidatePath("/indicadores");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[time-clock] falha ao justificar checklist:", error);
    return { ok: false, error: "Não foi possível salvar a justificativa." };
  }
}
