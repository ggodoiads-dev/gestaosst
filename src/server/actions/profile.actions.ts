"use server";

import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { attachMyCollaboratorPhoto } from "@/server/services/collaborator.service";
import { savePhotoUpload, InvalidUploadError } from "@/server/services/storage";

export type UpdatePhotoResult = { ok: true } | { ok: false; error: string };

/** O colaborador troca a própria foto no Meu Perfil. */
export async function updateMyPhotoAction(formData: FormData): Promise<UpdatePhotoResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Escolha uma foto válida." };
    }
    const saved = await savePhotoUpload(file);
    await attachMyCollaboratorPhoto(user, saved);
    revalidatePath("/meu-perfil");
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidUploadError || error instanceof ForbiddenError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "Não foi possível salvar a foto. Tente novamente." };
  }
}
