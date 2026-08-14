"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as productivityService from "@/server/services/productivity.service";
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

const entrySchema = z.object({
  collaboratorId: z.string().min(1),
  date: z.string().min(1),
  activityId: z.string().min(1, "Selecione a atividade."),
  quantity: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function createProductivityEntryAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = entrySchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      date: formData.get("date"),
      activityId: formData.get("activityId"),
      quantity: formData.get("quantity") || null,
      notes: formData.get("notes") || null,
    });
    await productivityService.createProductivityEntry(user, {
      collaboratorId: parsed.collaboratorId,
      date: parseDateOnly(parsed.date),
      activityId: parsed.activityId,
      quantity: parsed.quantity ? Number(parsed.quantity) : null,
      notes: parsed.notes,
    });
    revalidatePath("/produtividade");
  });
}

export async function deleteProductivityEntryAction(id: string) {
  const user = await requireUser();
  await productivityService.deleteProductivityEntry(user, id);
  revalidatePath("/produtividade");
}

const goalSchema = z.object({
  collaboratorId: z.string().min(1, "Selecione o colaborador."),
  activityId: z.string().min(1, "Selecione a atividade."),
  month: z.string().min(1),
  year: z.string().min(1),
  targetQuantity: z.string().trim().min(1, "Informe a meta."),
});

export async function upsertProductivityGoalAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = goalSchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      activityId: formData.get("activityId"),
      month: formData.get("month"),
      year: formData.get("year"),
      targetQuantity: formData.get("targetQuantity"),
    });
    const targetQuantity = Number(parsed.targetQuantity);
    if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
      throw new z.ZodError([{ code: "custom", message: "Meta precisa ser maior que zero.", path: ["targetQuantity"] }]);
    }
    await productivityService.upsertProductivityGoal(user, {
      collaboratorId: parsed.collaboratorId,
      activityId: parsed.activityId,
      month: Number(parsed.month),
      year: Number(parsed.year),
      targetQuantity,
    });
    revalidatePath("/produtividade");
  });
}

export async function deleteProductivityGoalAction(id: string) {
  const user = await requireUser();
  await productivityService.deleteProductivityGoal(user, id);
  revalidatePath("/produtividade");
}
