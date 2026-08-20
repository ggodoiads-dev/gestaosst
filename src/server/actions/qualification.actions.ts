"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as qualificationService from "@/server/services/qualification.service";
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

const qualificationTypeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do tipo de qualificação."),
  category: z.enum(["NR", "ASO", "INTEGRACAO", "OUTRO"]),
  validityMonths: z.string().trim().optional().nullable(),
  aliases: z.array(z.string().trim().min(1)).default([]),
});

function parseQualificationTypeForm(formData: FormData) {
  const parsed = qualificationTypeSchema.parse({
    name: formData.get("name"),
    category: formData.get("category") ?? "OUTRO",
    validityMonths: formData.get("validityMonths") || null,
    aliases: formData.getAll("aliases").map(String),
  });
  return {
    name: parsed.name,
    category: parsed.category,
    validityMonths: parsed.validityMonths ? Number(parsed.validityMonths) : null,
    aliases: parsed.aliases,
  };
}

export async function createQualificationTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseQualificationTypeForm(formData);
    await qualificationService.createQualificationType(user, data);
    revalidatePath("/cadastros/qualificacoes");
  });
}

export async function updateQualificationTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseQualificationTypeForm(formData);
    await qualificationService.updateQualificationType(user, id, data);
    revalidatePath("/cadastros/qualificacoes");
  });
}

export async function setQualificationTypeActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await qualificationService.setQualificationTypeActive(user, id, active);
  revalidatePath("/cadastros/qualificacoes");
}

const qualificationRecordSchema = z.object({
  collaboratorId: z.string().min(1, "Selecione o colaborador."),
  qualificationTypeId: z.string().min(1, "Selecione o tipo de qualificação."),
  completedDate: z.string().min(1, "Informe a data de conclusão."),
  notes: z.string().trim().optional().nullable(),
});

export async function createQualificationRecordAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = qualificationRecordSchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      qualificationTypeId: formData.get("qualificationTypeId"),
      completedDate: formData.get("completedDate"),
      notes: formData.get("notes") || null,
    });
    await qualificationService.createQualificationRecord(user, {
      collaboratorId: parsed.collaboratorId,
      qualificationTypeId: parsed.qualificationTypeId,
      completedDate: parseDateOnly(parsed.completedDate),
      notes: parsed.notes,
    });
    revalidatePath("/qualificacoes");
    revalidatePath(`/colaboradores/${parsed.collaboratorId}`);
  });
}

export async function updateQualificationRecordAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const parsed = qualificationRecordSchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      qualificationTypeId: formData.get("qualificationTypeId"),
      completedDate: formData.get("completedDate"),
      notes: formData.get("notes") || null,
    });
    await qualificationService.updateQualificationRecord(user, id, {
      collaboratorId: parsed.collaboratorId,
      qualificationTypeId: parsed.qualificationTypeId,
      completedDate: parseDateOnly(parsed.completedDate),
      notes: parsed.notes,
    });
    revalidatePath("/qualificacoes");
    revalidatePath(`/colaboradores/${parsed.collaboratorId}`);
  });
}

export async function deleteQualificationRecordAction(id: string, collaboratorId: string): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await qualificationService.deleteQualificationRecord(user, id);
    revalidatePath("/qualificacoes");
    revalidatePath(`/colaboradores/${collaboratorId}`);
  });
}
