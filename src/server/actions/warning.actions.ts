"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as warningService from "@/server/services/warning.service";
import { parseDateOnly } from "@/lib/dates";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  return fn()
    .then(() => ({ ok: true as const }))
    .catch((error: unknown) => {
      if (error instanceof ForbiddenError) return { ok: false as const, error: error.message };
      if (error instanceof z.ZodError) {
        return { ok: false as const, error: error.issues[0]?.message ?? "Dados inválidos." };
      }
      console.error(error);
      return { ok: false as const, error: "Não foi possível concluir a operação." };
    });
}

const warningSchema = z.object({
  collaboratorId: z.string().min(1),
  date: z.string().min(1, "Informe a data."),
  reason: z.string().trim().min(2, "Informe o motivo da advertência."),
});

export async function createWarningAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = warningSchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      date: formData.get("date"),
      reason: formData.get("reason"),
    });
    await warningService.createWarning(user, {
      collaboratorId: parsed.collaboratorId,
      date: parseDateOnly(parsed.date),
      reason: parsed.reason,
    });
    revalidatePath(`/colaboradores/${parsed.collaboratorId}`);
  });
}

export async function deleteWarningAction(id: string, collaboratorId: string) {
  const user = await requireUser();
  await warningService.deleteWarning(user, id);
  revalidatePath(`/colaboradores/${collaboratorId}`);
}
