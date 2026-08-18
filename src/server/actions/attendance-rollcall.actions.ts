"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as rollCallService from "@/server/services/attendance-rollcall.service";
import type { RollCallSubmission } from "@/server/services/attendance-rollcall.service";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function getTodayRollCallAction() {
  const user = await requireUser();
  return rollCallService.getTodayRollCall(user);
}

export async function submitRollCallAction(entries: RollCallSubmission[]): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await rollCallService.submitRollCall(user, entries);
    revalidatePath("/chamada");
    revalidatePath("/escalas");
    revalidatePath("/pendencias-advertencia");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível registrar a chamada." };
  }
}
