"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/pipeline.service";
import type { CycleInput, PipelineWorkbook, PositionInput } from "@/server/services/pipeline.service";

export type PipelineResult = { ok: true } | { ok: false; error: string };

const KNOWN = /Informe o|Ano inválido/;

async function run(fn: () => Promise<void>): Promise<PipelineResult> {
  try {
    await fn();
    revalidatePath("/pipeline");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[pipeline] falha:", error);
    return { ok: false, error: "Não foi possível salvar. As tabelas do Pipeline já foram criadas no banco?" };
  }
}

export async function savePositionAction(id: string | null, input: PositionInput): Promise<PipelineResult> {
  return run(async () => void (await service.savePosition(await requireUser(), id, input)));
}

export async function deletePositionAction(id: string): Promise<PipelineResult> {
  return run(async () => service.deletePosition(await requireUser(), id));
}

export async function saveCycleEntryAction(id: string | null, input: CycleInput): Promise<PipelineResult> {
  return run(async () => void (await service.saveCycleEntry(await requireUser(), id, input)));
}

export async function saveRiskFollowAction(id: string, input: { situation?: string | null; follow?: string | null }): Promise<PipelineResult> {
  return run(async () => service.saveRiskFollow(await requireUser(), id, input));
}

export async function deleteCycleEntryAction(id: string): Promise<PipelineResult> {
  return run(async () => service.deleteCycleEntry(await requireUser(), id));
}

export type ReadWorkbookResult = ({ ok: true } & PipelineWorkbook) | { ok: false; error: string };

export async function readPipelineWorkbookAction(formData: FormData): Promise<ReadWorkbookResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecione um arquivo .xlsx." };
    if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "Use a planilha em .xlsx." };
    const workbook = await service.readPipelineWorkbook(user, Buffer.from(await file.arrayBuffer()));
    return { ok: true, ...workbook };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[pipeline] falha ao ler a planilha:", error);
    return { ok: false, error: "Não foi possível ler esse arquivo. Confira se é a planilha de gestão do pipeline (.xlsx)." };
  }
}

export type CommitResult = { ok: true; positionsSaved: number; cyclesSaved: number } | { ok: false; error: string };

export async function commitPipelineImportAction(input: { positions: PositionInput[]; cycles: CycleInput[]; replacePositions: boolean; cycleYear: number }): Promise<CommitResult> {
  try {
    const result = await service.commitPipelineImport(await requireUser(), input);
    revalidatePath("/pipeline");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[pipeline] falha ao importar:", error);
    return { ok: false, error: "Não foi possível importar. As tabelas do Pipeline já foram criadas no banco?" };
  }
}
