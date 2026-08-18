"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import * as equipmentService from "@/server/services/equipment.service";
import { savePhotoUpload } from "@/server/services/storage";
import { ForbiddenError } from "@/server/auth/current-user";
import type { CurrentUser } from "@/server/auth/current-user";

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

const equipmentSchema = z.object({
  code: z.string().trim().min(2, "Informe o código do equipamento.").toUpperCase(),
  name: z.string().trim().min(2, "Informe o nome do equipamento."),
  assetTag: z.string().trim().optional().nullable(),
  typeId: z.string().min(1, "Selecione o tipo de equipamento."),
  manufacturer: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  serialNumber: z.string().trim().optional().nullable(),
  unitId: z.string().min(1, "Selecione a unidade."),
  areaId: z.string().min(1, "Selecione a área."),
  sector: z.string().trim().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  criticality: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  notes: z.string().trim().optional().nullable(),
});

function parseEquipmentForm(formData: FormData) {
  return equipmentSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    assetTag: formData.get("assetTag") || null,
    typeId: formData.get("typeId"),
    manufacturer: formData.get("manufacturer") || null,
    model: formData.get("model") || null,
    serialNumber: formData.get("serialNumber") || null,
    unitId: formData.get("unitId"),
    areaId: formData.get("areaId"),
    sector: formData.get("sector") || null,
    responsibleId: formData.get("responsibleId") || null,
    criticality: formData.get("criticality") ?? "MEDIA",
    notes: formData.get("notes") || null,
  });
}

/** Foto é opcional: se o envio falhar, o cadastro/edição do equipamento não é desfeito por causa disso. */
async function maybeAttachPhoto(user: CurrentUser, equipmentId: string, formData: FormData) {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return;

  try {
    const saved = await savePhotoUpload(photo);
    await equipmentService.attachEquipmentPhoto(user, equipmentId, saved);
  } catch (error) {
    console.error("Falha ao anexar foto do equipamento:", error);
  }
}

export async function createEquipmentAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseEquipmentForm(formData);
    const created = await equipmentService.createEquipment(user, data);
    await maybeAttachPhoto(user, created.id, formData);
    revalidatePath("/cadastros/equipamentos");
    revalidatePath("/equipamentos");
  });
}

export async function updateEquipmentAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseEquipmentForm(formData);
    await equipmentService.updateEquipment(user, id, data);
    await maybeAttachPhoto(user, id, formData);
    revalidatePath("/cadastros/equipamentos");
    revalidatePath("/equipamentos");
    revalidatePath(`/equipamentos/${id}`);
  });
}

export async function setEquipmentActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await equipmentService.setEquipmentActive(user, id, active);
  revalidatePath("/cadastros/equipamentos");
  revalidatePath("/equipamentos");
  revalidatePath(`/equipamentos/${id}`);
  revalidatePath("/checklist/realizar");
  revalidatePath("/inicio");
  revalidatePath("/equipamentos/painel");
}

export async function setCollaboratorEquipmentAptitudesAction(
  collaboratorId: string,
  equipmentIds: string[],
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await equipmentService.setCollaboratorEquipmentAptitudes(user, collaboratorId, equipmentIds);
    revalidatePath(`/colaboradores/${collaboratorId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível salvar as aptidões." };
  }
}
