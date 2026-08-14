"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as templateService from "@/server/services/checklist-template.service";

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

const templateSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do modelo."),
  description: z.string().trim().optional().nullable(),
  equipmentTypeId: z.string().min(1, "Selecione o tipo de equipamento."),
});

export async function createTemplateAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = templateSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || null,
      equipmentTypeId: formData.get("equipmentTypeId"),
    });
    const template = await templateService.createTemplate(user, data);
    revalidatePath("/cadastros/modelos-checklist");
    return template;
  });
}

export async function createNewDraftVersionAction(templateId: string) {
  const user = await requireUser();
  await templateService.createNewDraftVersion(user, templateId);
  revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
}

export async function publishVersionAction(templateId: string, versionId: string) {
  const user = await requireUser();
  await templateService.publishVersion(user, versionId);
  revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
  revalidatePath("/cadastros/modelos-checklist");
}

const ruleSchema = z.object({
  triggerValue: z.string().min(1),
  isCritical: z.boolean(),
  requiresComment: z.boolean(),
  requiresPhoto: z.boolean(),
  createsNonconformity: z.boolean(),
  blocksEquipment: z.boolean(),
  newEquipmentStatus: z.enum(["LIBERADO_COM_OBSERVACAO", "RESTRITO", "BLOQUEADO"]).optional().nullable(),
  severity: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]).optional().nullable(),
  faultCategoryId: z.string().optional().nullable(),
});

const questionSchema = z.object({
  versionId: z.string().min(1),
  title: z.string().trim().min(3, "Informe o texto da pergunta."),
  description: z.string().trim().optional().nullable(),
  type: z.enum([
    "CONFORME_NAO_CONFORME",
    "SIM_NAO",
    "BOM_REGULAR_RUIM",
    "MULTIPLA_ESCOLHA",
    "SELECAO_UNICA",
    "TEXTO_CURTO",
    "TEXTO_LONGO",
    "NUMERO",
    "DATA",
    "FOTO",
    "CONFIRMACAO",
  ]),
  required: z.boolean(),
  allowNotApplicable: z.boolean(),
  guidance: z.string().trim().optional().nullable(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  rule: ruleSchema.nullable().optional(),
});

export async function addQuestionAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();

    const optionsRaw = formData.get("optionsJson");
    const ruleRaw = formData.get("ruleJson");

    const data = questionSchema.parse({
      versionId: formData.get("versionId"),
      title: formData.get("title"),
      description: formData.get("description") || null,
      type: formData.get("type"),
      required: formData.get("required") === "on",
      allowNotApplicable: formData.get("allowNotApplicable") === "on",
      guidance: formData.get("guidance") || null,
      options: optionsRaw ? JSON.parse(String(optionsRaw)) : undefined,
      rule: ruleRaw ? JSON.parse(String(ruleRaw)) : null,
    });

    const templateId = String(formData.get("templateId"));

    await templateService.addQuestion(user, data.versionId, data);
    revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
  });
}

export async function removeQuestionAction(templateId: string, questionId: string) {
  const user = await requireUser();
  await templateService.removeQuestion(user, questionId);
  revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
}

export async function updateVersionPeriodicityAction(
  templateId: string,
  versionId: string,
  periodicity: string,
) {
  const user = await requireUser();
  await templateService.updateVersionPeriodicity(
    user,
    versionId,
    periodicity as never,
  );
  revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
}

export async function assignTemplateAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const templateId = String(formData.get("templateId"));
    const equipmentIds = formData.getAll("equipmentIds").map(String);
    await templateService.assignTemplateToEquipments(user, templateId, equipmentIds);
    revalidatePath(`/cadastros/modelos-checklist/${templateId}`);
    revalidatePath("/checklist/realizar");
  });
}
