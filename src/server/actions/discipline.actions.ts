"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as service from "@/server/services/discipline.service";
import type { DisciplineReasonKey, DisciplineStepKey } from "@/domain/discipline/ladder";

export type DisciplineResult = { ok: true; id?: string } | { ok: false; error: string };

async function run(fn: () => Promise<{ id: string } | void>): Promise<DisciplineResult> {
  try {
    const created = await fn();
    revalidatePath("/pendencias-advertencia");
    revalidatePath("/escalas");
    revalidatePath("/presenca");
    return { ok: true, id: created ? created.id : undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Motivo inválido|Medida inválida|Data inválida|Escreva o motivo|já foi tratada|Registro não encontrado/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    console.error("[discipline] falha:", error);
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  }
}

type Input = { reason: DisciplineReasonKey; collaboratorId: string; dayKey: string; step: DisciplineStepKey; note: string };

export async function applyMeasureAction(input: Input) {
  return run(async () => service.applyMeasure(await requireUser(), input));
}

export async function dismissOccurrenceAction(input: Input) {
  return run(async () => service.dismissOccurrence(await requireUser(), input));
}

export async function undoDecisionAction(id: string) {
  return run(async () => {
    await service.undoDecision(await requireUser(), id);
  });
}
