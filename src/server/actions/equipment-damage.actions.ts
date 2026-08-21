"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as equipmentDamageService from "@/server/services/equipment-damage.service";
import { saveAttachmentUpload, InvalidUploadError } from "@/server/services/storage";
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

const equipmentDamageSchema = z.object({
  equipmentId: z.string().min(1, "Selecione o equipamento."),
  date: z.string().min(1, "Informe a data."),
  collaboratorId: z.string().optional().nullable(),
  description: z.string().trim().min(2, "Descreva o que aconteceu."),
  cost: z.preprocess((val) => {
    if (typeof val !== "string" || val.trim() === "") return null;
    return Number(val.replace(",", "."));
  }, z.number("Valor inválido.").nonnegative("Valor inválido.").nullable()),
  notes: z.string().trim().optional().nullable(),
});

function parseEquipmentDamageForm(formData: FormData) {
  const parsed = equipmentDamageSchema.parse({
    equipmentId: formData.get("equipmentId"),
    date: formData.get("date"),
    collaboratorId: formData.get("collaboratorId") || null,
    description: formData.get("description"),
    cost: formData.get("cost"),
    notes: formData.get("notes") || null,
  });
  return { ...parsed, date: parseDateOnly(parsed.date) };
}

export async function createEquipmentDamageAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseEquipmentDamageForm(formData);
    await equipmentDamageService.createEquipmentDamage(user, data);
    revalidatePath("/frota");
  });
}

export async function updateEquipmentDamageAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseEquipmentDamageForm(formData);
    await equipmentDamageService.updateEquipmentDamage(user, id, data);
    revalidatePath("/frota");
    revalidatePath(`/frota/${id}`);
  });
}

export async function updateEquipmentDamageStatusAction(id: string, status: "ABERTO" | "EM_REPARO" | "RESOLVIDO") {
  const user = await requireUser();
  await equipmentDamageService.updateEquipmentDamageStatus(user, id, status);
  revalidatePath("/frota");
  revalidatePath(`/frota/${id}`);
}

export async function uploadEquipmentDamageAttachmentAction(equipmentDamageId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Selecione um arquivo válido." };
    }
    const saved = await saveAttachmentUpload(file);
    await equipmentDamageService.attachEquipmentDamageFile(user, equipmentDamageId, saved);
    revalidatePath(`/frota/${equipmentDamageId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidUploadError) return { ok: false, error: error.message };
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível enviar o arquivo." };
  }
}
