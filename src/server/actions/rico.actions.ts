"use server";

import { requireUser } from "@/server/auth/current-user";
import {
  runRicoTurn,
  executeRicoAction,
  getProactiveTip,
  type PendingAction,
  type RicoTurnResult,
  type ProactiveSignal,
} from "@/server/services/rico.service";
import { revalidatePath } from "next/cache";
import { canUseRico } from "@/server/services/nav-access.service";

export type { RicoTurnResult, PendingAction, ProactiveSignal };

export async function sendRicoMessageAction(
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
): Promise<RicoTurnResult> {
  const user = await requireUser();
  if (!(await canUseRico(user))) return { reply: "O Rico não está liberado para o seu acesso.", pendingAction: null };
  return runRicoTurn(user, history, message);
}

export type ConfirmRicoActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function confirmRicoActionAction(action: PendingAction): Promise<ConfirmRicoActionResult> {
  const user = await requireUser();
  if (!(await canUseRico(user))) return { ok: false, error: "O Rico não está liberado para o seu acesso." };
  const result = await executeRicoAction(user, action.tool, action.args);
  if (result.ok) {
    revalidatePath("/atividades");
    revalidatePath("/qualificacoes");
  }
  return result;
}

export async function getRicoProactiveTipAction(signal: ProactiveSignal): Promise<string | null> {
  const user = await requireUser();
  if (!(await canUseRico(user))) return null;
  return getProactiveTip(user, signal);
}
