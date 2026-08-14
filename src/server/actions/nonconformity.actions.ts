"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as ncService from "@/server/services/nonconformity.service";
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

const actionItemSchema = z.object({
  description: z.string().trim().min(3, "Descreva a ação."),
  responsibleId: z.string().min(1, "Selecione o responsável."),
  dueDate: z.string().min(1, "Informe o prazo."),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA"]),
});

export async function createActionItemAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const nonconformityId = String(formData.get("nonconformityId"));
    const data = actionItemSchema.parse({
      description: formData.get("description"),
      responsibleId: formData.get("responsibleId"),
      dueDate: formData.get("dueDate"),
      priority: formData.get("priority") ?? "MEDIA",
    });
    await ncService.createActionItem(user, nonconformityId, {
      ...data,
      dueDate: parseDateOnly(data.dueDate),
    });
    revalidatePath(`/nao-conformidades/${nonconformityId}`);
    revalidatePath("/nao-conformidades");
    revalidatePath("/planos-de-acao");
  });
}

export async function completeActionItemAction(nonconformityId: string, actionItemId: string, notes: string) {
  const user = await requireUser();
  await ncService.completeActionItem(user, actionItemId, notes || null);
  revalidatePath(`/nao-conformidades/${nonconformityId}`);
  revalidatePath("/planos-de-acao");
}

export async function validateActionItemAction(nonconformityId: string, actionItemId: string, equipmentId: string) {
  const user = await requireUser();
  await ncService.validateActionItem(user, actionItemId);
  revalidatePath(`/nao-conformidades/${nonconformityId}`);
  revalidatePath("/nao-conformidades");
  revalidatePath("/planos-de-acao");
  revalidatePath(`/equipamentos/${equipmentId}`);
  revalidatePath("/inicio");
  revalidatePath("/equipamentos/painel");
}

export async function assignResponsibleAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const responsibleId = String(formData.get("responsibleId"));
    const dueDateRaw = formData.get("dueDate");
    await ncService.assignNonconformityResponsible(
      user,
      id,
      responsibleId,
      dueDateRaw ? parseDateOnly(String(dueDateRaw)) : null,
    );
    revalidatePath(`/nao-conformidades/${id}`);
  });
}
