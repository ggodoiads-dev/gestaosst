"use server";

import { z } from "zod";
import { head } from "@vercel/blob";
import { DOCUMENT_BLOB_NAME, DOCUMENT_MIME_EXT, MAX_DOCUMENT_SIZE_BYTES } from "@/domain/shared/document-upload";
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

export async function setCollaboratorActivityAptitudesAction(collaboratorId: string, activityIds: string[]): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await activityService.setCollaboratorActivityAptitudes(user, collaboratorId, activityIds);
    revalidatePath(`/colaboradores/${collaboratorId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível salvar as aptidões." };
  }
}

export async function deleteActivityDocumentAction(attachmentId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const activityId = await activityService.deleteActivityDocument(user, attachmentId);
    if (activityId) revalidatePath(`/atividades/${activityId}`);
    revalidatePath("/atividades");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível apagar o documento." };
  }
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

/** Registra na atividade um documento que o navegador já enviou direto ao armazenamento (ver `/api/uploads/token`). */
export async function registerActivityDocumentAction(
  activityId: string,
  docType: "POP" | "AR_VR" | "LISTA_TREINAMENTO",
  uploaded: { pathname: string; filename: string; mimeType: string; size: number },
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!DOCUMENT_BLOB_NAME.test(uploaded.pathname) || !DOCUMENT_MIME_EXT[uploaded.mimeType] || uploaded.size <= 0 || uploaded.size > MAX_DOCUMENT_SIZE_BYTES) {
      return { ok: false, error: "Arquivo inválido." };
    }
    // Só registra se o arquivo realmente chegou ao armazenamento.
    if (process.env.STORAGE_DRIVER === "blob") {
      try {
        await head(uploaded.pathname);
      } catch {
        return { ok: false, error: "O arquivo não chegou ao armazenamento. Tente enviar de novo." };
      }
    }
    await activityService.attachActivityDocument(user, activityId, docType, {
      filename: uploaded.filename.slice(0, 200),
      path: `uploads/${uploaded.pathname}`,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    });
    revalidatePath(`/atividades/${activityId}`);
    revalidatePath("/atividades");
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível registrar o documento." };
  }
}

export async function setActivityAreasAction(activityId: string, areaIds: string[]): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await activityService.setActivityAreas(user, activityId, areaIds);
    revalidatePath(`/atividades/${activityId}`);
  });
}
