"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as activityService from "@/server/services/activity.service";
import { saveDocumentUpload, InvalidUploadError } from "@/server/services/storage";

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

const activitySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da atividade."),
  code: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
});

function parseActivityForm(formData: FormData) {
  return activitySchema.parse({
    name: formData.get("name"),
    code: formData.get("code") || null,
    description: formData.get("description") || null,
    unit: formData.get("unit") || null,
  });
}

export async function createActivityAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseActivityForm(formData);
    await activityService.createActivity(user, data);
    revalidatePath("/atividades");
  });
}

export async function updateActivityAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseActivityForm(formData);
    await activityService.updateActivity(user, id, data);
    revalidatePath("/atividades");
    revalidatePath(`/atividades/${id}`);
  });
}

export async function setActivityActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await activityService.setActivityActive(user, id, active);
  revalidatePath("/atividades");
  revalidatePath(`/atividades/${id}`);
}

export async function uploadActivityDocumentAction(
  activityId: string,
  docType: "POP" | "AR_VR" | "LISTA_TREINAMENTO",
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido." };
    }
    const saved = await saveDocumentUpload(file);
    await activityService.attachActivityDocument(user, activityId, docType, saved);
    revalidatePath(`/atividades/${activityId}`);
    revalidatePath("/atividades");
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidUploadError) return { ok: false, error: error.message };
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível enviar o arquivo." };
  }
}
