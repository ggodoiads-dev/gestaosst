"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { setDtoActionStatus, setDtoActionsStatus, rescheduleDtoActions } from "@/server/services/dto-action.service";
import type { ActionItemStatus } from "@/generated/prisma/enums";

export type DtoActionStatusResult = { ok: true } | { ok: false; error: string };

export async function setDtoActionStatusAction(id: string, status: ActionItemStatus, reason?: string): Promise<DtoActionStatusResult> {
  try {
    const user = await requireUser();
    await setDtoActionStatus(user, id, status, reason);
    revalidatePath("/planos-de-acao");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Status inválido|justificativa obrigatória/.test(error.message)) return { ok: false, error: error.message };
    console.error("[dto-action] falha ao mudar status:", error);
    return { ok: false, error: "Não foi possível atualizar. Tente de novo." };
  }
}

export type DtoActionsBulkResult = { ok: true; count: number } | { ok: false; error: string };

const KNOWN = /Status inválido|justificativa obrigatória|Nenhuma ação|Data inválida|a partir de hoje|em aberto/;

export async function setDtoActionsStatusAction(ids: string[], status: ActionItemStatus, reason?: string): Promise<DtoActionsBulkResult> {
  try {
    const user = await requireUser();
    const count = await setDtoActionsStatus(user, ids, status, reason);
    revalidatePath("/planos-de-acao");
    return { ok: true, count };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[dto-action] falha ao mudar status em lote:", error);
    return { ok: false, error: "Não foi possível atualizar. Tente de novo." };
  }
}

export async function rescheduleDtoActionsAction(ids: string[], dayKey: string, reason?: string): Promise<DtoActionsBulkResult> {
  try {
    const user = await requireUser();
    const count = await rescheduleDtoActions(user, ids, dayKey, reason);
    revalidatePath("/planos-de-acao");
    return { ok: true, count };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && KNOWN.test(error.message)) return { ok: false, error: error.message };
    console.error("[dto-action] falha ao reprogramar:", error);
    return { ok: false, error: "Não foi possível reprogramar. Tente de novo." };
  }
}
