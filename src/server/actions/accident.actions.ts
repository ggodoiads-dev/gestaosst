"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import * as accidentService from "@/server/services/accident.service";
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

const accidentSchema = z.object({
  date: z.string().min(1, "Informe a data do acidente."),
  time: z.string().trim().optional().nullable(),
  areaId: z.string().optional().nullable(),
  type: z.enum(["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "QUASE_ACIDENTE", "DOENCA_OCUPACIONAL"]),
  severity: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  description: z.string().trim().min(2, "Descreva o que aconteceu."),
  immediateCause: z.string().trim().optional().nullable(),
  rootCause: z.string().trim().optional().nullable(),
  isSif: z.string().optional(),
  sifClassification: z.enum(["SIF_PRECURSOR", "SIF_POTENCIAL", "SIF_REAL"]).optional().nullable(),
  creditNumber: z.string().trim().optional().nullable(),
  involvedCollaboratorIds: z.array(z.string()).default([]),
  witnessCollaboratorIds: z.array(z.string()).default([]),
});

function parseAccidentForm(formData: FormData) {
  const parsed = accidentSchema.parse({
    date: formData.get("date"),
    time: formData.get("time") || null,
    areaId: formData.get("areaId") || null,
    type: formData.get("type") ?? "ACIDENTE_TIPICO",
    severity: formData.get("severity") ?? "MEDIA",
    description: formData.get("description"),
    immediateCause: formData.get("immediateCause") || null,
    rootCause: formData.get("rootCause") || null,
    isSif: formData.get("isSif") || undefined,
    sifClassification: formData.get("sifClassification") || null,
    creditNumber: formData.get("creditNumber") || null,
    involvedCollaboratorIds: formData.getAll("involvedCollaboratorIds").map(String),
    witnessCollaboratorIds: formData.getAll("witnessCollaboratorIds").map(String),
  });

  return { ...parsed, date: parseDateOnly(parsed.date), isSif: parsed.isSif === "on" };
}

export async function createAccidentAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseAccidentForm(formData);
    await accidentService.createAccident(user, data);
    revalidatePath("/acidentes");
  });
}

export async function updateAccidentAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseAccidentForm(formData);
    await accidentService.updateAccident(user, id, data);
    revalidatePath("/acidentes");
    revalidatePath(`/acidentes/${id}`);
  });
}

export async function updateAccidentStatusAction(
  id: string,
  status: "ABERTO" | "EM_INVESTIGACAO" | "CONCLUIDO" | "CANCELADA",
) {
  const user = await requireUser();
  await accidentService.updateAccidentStatus(user, id, status);
  revalidatePath("/acidentes");
  revalidatePath(`/acidentes/${id}`);
}

const accidentActionSchema = z.object({
  description: z.string().trim().min(2, "Descreva a ação."),
  responsibleUserId: z.string().optional().nullable(),
  responsibleCollaboratorId: z.string().optional().nullable(),
  dueDate: z.string().min(1, "Informe o prazo."),
});

export async function createAccidentActionItemAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const accidentId = String(formData.get("accidentId"));
    const parsed = accidentActionSchema.parse({
      description: formData.get("description"),
      responsibleUserId: formData.get("responsibleUserId") || null,
      responsibleCollaboratorId: formData.get("responsibleCollaboratorId") || null,
      dueDate: formData.get("dueDate"),
    });
    await accidentService.createAccidentAction(user, accidentId, {
      description: parsed.description,
      responsibleUserId: parsed.responsibleUserId,
      responsibleCollaboratorId: parsed.responsibleCollaboratorId,
      dueDate: parseDateOnly(parsed.dueDate),
    });
    revalidatePath(`/acidentes/${accidentId}`);
  });
}

export async function completeAccidentActionItemAction(actionId: string, accidentId: string) {
  const user = await requireUser();
  await accidentService.setAccidentActionStatus(user, actionId, "CONCLUIDA");
  revalidatePath(`/acidentes/${accidentId}`);
}
