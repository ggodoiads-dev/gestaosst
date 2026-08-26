"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as epiService from "@/server/services/epi.service";
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
      if (error instanceof Error) return { ok: false as const, error: error.message };
      console.error(error);
      return { ok: false as const, error: "Não foi possível concluir a operação." };
    });
}

// =========================================================================
// Tipos de EPI
// =========================================================================

const epiTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do EPI."),
  defaultCa: z.string().trim().optional().nullable(),
  validityMonths: z.string().trim().optional().nullable(),
});

function parseEpiTypeForm(formData: FormData) {
  const parsed = epiTypeSchema.parse({
    name: formData.get("name"),
    defaultCa: formData.get("defaultCa") || null,
    validityMonths: formData.get("validityMonths") || null,
  });
  return {
    name: parsed.name,
    defaultCa: parsed.defaultCa,
    validityMonths: parsed.validityMonths ? Number(parsed.validityMonths) : null,
  };
}

export async function createEpiTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseEpiTypeForm(formData);
    await epiService.createEpiType(user, data);
    revalidatePath("/cadastros/tipos-epi");
  });
}

export async function updateEpiTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseEpiTypeForm(formData);
    await epiService.updateEpiType(user, id, data);
    revalidatePath("/cadastros/tipos-epi");
  });
}

export async function setEpiTypeActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await epiService.setEpiTypeActive(user, id, active);
  revalidatePath("/cadastros/tipos-epi");
}

// =========================================================================
// Funções e kit de EPI
// =========================================================================

const jobFunctionSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da função."),
});

export async function createJobFunctionAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = jobFunctionSchema.parse({ name: formData.get("name") });
    await epiService.createJobFunction(user, data);
    revalidatePath("/cadastros/funcoes");
  });
}

export async function setJobFunctionActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await epiService.setJobFunctionActive(user, id, active);
  revalidatePath("/cadastros/funcoes");
}

export async function setJobFunctionRequiresNrAction(id: string, requiresNr: boolean): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await epiService.setJobFunctionRequiresNr(user, id, requiresNr);
    revalidatePath("/cadastros/funcoes");
  });
}

const kitSchema = z.object({
  jobFunctionId: z.string().min(1),
  items: z.array(z.object({ epiTypeId: z.string().min(1), quantity: z.number().int().min(1) })),
});

export async function setJobFunctionKitAction(
  jobFunctionId: string,
  items: { epiTypeId: string; quantity: number }[],
): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = kitSchema.parse({ jobFunctionId, items });
    await epiService.setJobFunctionKit(user, parsed.jobFunctionId, parsed.items);
    revalidatePath("/cadastros/funcoes");
  });
}

const requiredChecklistsSchema = z.object({
  jobFunctionId: z.string().min(1),
  templateIds: z.array(z.string().min(1)),
});

export async function setJobFunctionRequiredChecklistsAction(
  jobFunctionId: string,
  templateIds: string[],
): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = requiredChecklistsSchema.parse({ jobFunctionId, templateIds });
    await epiService.setJobFunctionRequiredChecklists(user, parsed.jobFunctionId, parsed.templateIds);
    revalidatePath("/cadastros/funcoes");
  });
}

// =========================================================================
// Entregas de EPI (ficha do colaborador)
// =========================================================================

const epiDeliverySchema = z.object({
  collaboratorId: z.string().min(1),
  epiTypeId: z.string().min(1, "Selecione o EPI."),
  quantity: z.string().trim().optional(),
  ca: z.string().trim().optional().nullable(),
  size: z.string().trim().optional().nullable(),
  reason: z.enum([
    "PRIMEIRA_ENTREGA",
    "SUBSTITUICAO_DANO_JUSTIFICADO",
    "SUBSTITUICAO_DANO_PROPRIO_PERDA",
    "TROCA_DANIFICADO_VENCIDO",
    "DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO",
  ]),
  deliveredAt: z.string().min(1, "Informe a data de entrega."),
  traceable: z.boolean().optional(),
});

export async function createEpiDeliveryAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = epiDeliverySchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      epiTypeId: formData.get("epiTypeId"),
      quantity: formData.get("quantity") || undefined,
      ca: formData.get("ca") || null,
      size: formData.get("size") || null,
      reason: formData.get("reason") || "PRIMEIRA_ENTREGA",
      deliveredAt: formData.get("deliveredAt"),
      traceable: formData.get("traceable") === "on",
    });

    await epiService.createEpiDelivery(user, {
      collaboratorId: parsed.collaboratorId,
      epiTypeId: parsed.epiTypeId,
      quantity: parsed.quantity ? Number(parsed.quantity) : 1,
      ca: parsed.ca,
      size: parsed.size,
      reason: parsed.reason,
      deliveredAt: parseDateOnly(parsed.deliveredAt),
      traceable: parsed.traceable ?? false,
    });
    revalidatePath(`/colaboradores/${parsed.collaboratorId}`);
  });
}

export async function markEpiDeliveryReturnedAction(
  id: string,
  collaboratorId: string,
): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await epiService.markEpiDeliveryReturned(user, id, new Date());
    revalidatePath(`/colaboradores/${collaboratorId}`);
  });
}
