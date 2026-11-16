"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { addManualBankEntry, creditHolidayWork, deleteBankEntry } from "@/server/services/bank-hours.service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const GENERIC = "Não foi possível salvar. Se a atualização do banco de dados do Banco de Horas ainda não foi feita, ela precisa ser aplicada primeiro.";

async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const result = await fn();
    revalidatePath("/banco-de-horas");
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Explique|Informe|inválida|feriado nacional/.test(error.message)) return { ok: false, error: error.message };
    console.error("[banco-de-horas] falha:", error);
    return { ok: false, error: GENERIC };
  }
}

export async function creditHolidayWorkAction(dateKey: string, collaboratorIds: string[]): Promise<Result<{ created: number }>> {
  return run(async () => creditHolidayWork(await requireUser(), { dateKey, collaboratorIds }));
}

export async function addManualBankEntryAction(input: { collaboratorId: string; dateKey: string; days: number; note: string }): Promise<Result> {
  return run(async () => {
    await addManualBankEntry(await requireUser(), input);
    return {};
  });
}

export async function deleteBankEntryAction(id: string): Promise<Result> {
  return run(async () => {
    await deleteBankEntry(await requireUser(), id);
    return {};
  });
}
