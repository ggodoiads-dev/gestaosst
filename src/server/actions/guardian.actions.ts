"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { reopenGuardianMonth, resolveGoldenRule, saveLeadershipFunctions } from "@/server/services/guardian.service";
import type { GoldenRuleOutcome } from "@/domain/guardian/golden-rule";

/** Reabre um mês fechado do Guardian: o fechamento é apagado e o mês volta a ser calculado (e congelado de novo) na próxima consulta. */
export async function reopenGuardianMonthAction(month: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await reopenGuardianMonth(user, month);
    revalidatePath("/guardian");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[guardian] falha ao reabrir o mês:", error);
    return { ok: false, error: "Não foi possível reabrir o mês." };
  }
}

/** Conclui um relato de Regra de Ouro (MDT aplicado ou desconsiderado) ou reabre (outcome nulo). */
export async function resolveGoldenRuleAction(
  guardianId: string,
  outcome: GoldenRuleOutcome | null,
  note: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await resolveGoldenRule(user, guardianId, outcome, note);
    revalidatePath("/guardian");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[guardian] falha ao concluir regra de ouro:", error);
    return { ok: false, error: "Não foi possível salvar. Se a atualização do banco do Guardian ainda não foi feita, ela precisa ser aplicada primeiro." };
  }
}

/** Define quais cargos contam como liderança na adesão do Guardian. */
export async function saveLeadershipFunctionsAction(functionIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await saveLeadershipFunctions(user, functionIds);
    revalidatePath("/guardian");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error("[guardian] falha ao salvar a liderança:", error);
    return { ok: false, error: "Não foi possível salvar. Se a atualização do banco do Guardian ainda não foi feita, ela precisa ser aplicada primeiro." };
  }
}
