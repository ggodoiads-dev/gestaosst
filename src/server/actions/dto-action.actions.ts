"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { setDtoActionStatus } from "@/server/services/dto-action.service";
import type { ActionItemStatus } from "@/generated/prisma/enums";

export type DtoActionStatusResult = { ok: true } | { ok: false; error: string };

export async function setDtoActionStatusAction(id: string, status: ActionItemStatus): Promise<DtoActionStatusResult> {
  try {
    const user = await requireUser();
    await setDtoActionStatus(user, id, status);
    revalidatePath("/planos-de-acao");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Status inválido/.test(error.message)) return { ok: false, error: error.message };
    console.error("[dto-action] falha ao mudar status:", error);
    return { ok: false, error: "Não foi possível atualizar. Tente de novo." };
  }
}
