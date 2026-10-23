"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as productionService from "@/server/services/production.service";
import type { ProductionValues } from "@/domain/production/fields";
import * as productivityService from "@/server/services/productivity.service";
import { parseDateOnly } from "@/lib/dates";

export type ProductionResult = { ok: true } | { ok: false; error: string };

const KNOWN_ERRORS = /Data inválida|não pode ser futura|Preencha ao menos/;

export async function saveShiftProductionAction(input: { day: string; turnoId: string; values: ProductionValues; notes: string }): Promise<ProductionResult> {
  try {
    const user = await requireUser();
    await productionService.saveShiftProduction(user, input);
    revalidatePath("/producao");
    revalidatePath("/producao/lancar");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: "Você não pode lançar a produção deste turno." };
    if (error instanceof Error && KNOWN_ERRORS.test(error.message)) return { ok: false, error: error.message };
    console.error("[producao] falha ao salvar:", error);
    return { ok: false, error: "Não foi possível salvar o relatório. Tente de novo." };
  }
}

export async function deleteShiftProductionAction(id: string): Promise<ProductionResult> {
  try {
    const user = await requireUser();
    await productionService.deleteShiftProduction(user, id);
    revalidatePath("/producao");
    revalidatePath("/producao/lancar");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: "Você não pode apagar este relatório." };
    console.error("[producao] falha ao apagar:", error);
    return { ok: false, error: "Não foi possível apagar o relatório." };
  }
}

/** Relatório já lançado para o dia + turno escolhidos (a tela de lançamento abre preenchida para corrigir). */
export async function loadShiftProductionAction(day: string, turnoId: string) {
  const user = await requireUser();
  return productionService.getShiftProduction(user, day, turnoId);
}

export type PeopleEntriesResult = { ok: true; created: number; updated: number; skipped: number } | { ok: false; error: string };

/** Lança por pessoa o que veio do fechamento dos ajudantes (uma linha por pessoa e atividade). */
export async function savePeopleEntriesAction(input: { day: string; entries: { collaboratorId: string; activityId: string; quantity: number | null; notes: string | null }[] }): Promise<PeopleEntriesResult> {
  try {
    const user = await requireUser();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { ok: false, error: "Data inválida." };
    if (input.entries.length === 0) return { ok: true, created: 0, updated: 0, skipped: 0 };
    const result = await productivityService.saveProductivityEntriesBatch(user, { date: parseDateOnly(input.day), entries: input.entries });
    revalidatePath("/produtividade", "layout");
    revalidatePath("/minha-produtividade");
    return { ok: true, created: result.created, updated: result.updated, skipped: result.skipped.length };
  } catch (error) {
    console.error("[producao] falha ao lançar por pessoa:", error);
    return { ok: false, error: "Não foi possível lançar por pessoa. Tente de novo." };
  }
}
