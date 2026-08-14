"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import * as masterdata from "@/server/services/masterdata.service";
import { ForbiddenError } from "@/server/auth/current-user";

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

const unitSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da unidade."),
  code: z.string().trim().min(2, "Informe o código da unidade.").toUpperCase(),
});

export async function createUnitAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = unitSchema.parse({ name: formData.get("name"), code: formData.get("code") });
    await masterdata.createUnit(user, data);
    revalidatePath("/cadastros/areas");
  });
}

export async function updateUnitAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = unitSchema.parse({ name: formData.get("name"), code: formData.get("code") });
    await masterdata.updateUnit(user, id, data);
    revalidatePath("/cadastros/areas");
  });
}

const areaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da área."),
  code: z.string().trim().min(2, "Informe o código da área.").toUpperCase(),
  unitId: z.string().min(1, "Selecione a unidade."),
  sector: z.string().trim().optional().nullable(),
});

export async function createAreaAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = areaSchema.parse({
      name: formData.get("name"),
      code: formData.get("code"),
      unitId: formData.get("unitId"),
      sector: formData.get("sector") || null,
    });
    await masterdata.createArea(user, data);
    revalidatePath("/cadastros/areas");
  });
}

export async function updateAreaAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = areaSchema.parse({
      name: formData.get("name"),
      code: formData.get("code"),
      unitId: formData.get("unitId"),
      sector: formData.get("sector") || null,
    });
    await masterdata.updateArea(user, id, data);
    revalidatePath("/cadastros/areas");
  });
}

export async function setUnitActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await masterdata.setUnitActive(user, id, active);
  revalidatePath("/cadastros/areas");
}

export async function setAreaActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await masterdata.setAreaActive(user, id, active);
  revalidatePath("/cadastros/areas");
}

const equipmentTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do tipo."),
  code: z.string().trim().min(2, "Informe o código do tipo.").toUpperCase(),
  description: z.string().trim().optional().nullable(),
});

export async function createEquipmentTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = equipmentTypeSchema.parse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") || null,
    });
    await masterdata.createEquipmentType(user, data);
    revalidatePath("/cadastros/equipamentos");
  });
}

export async function updateEquipmentTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = equipmentTypeSchema.parse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") || null,
    });
    await masterdata.updateEquipmentType(user, id, data);
    revalidatePath("/cadastros/equipamentos");
  });
}
