"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { reopenGuardianMonth } from "@/server/services/guardian.service";

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
