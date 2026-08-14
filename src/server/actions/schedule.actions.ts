"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, ForbiddenError, type CurrentUser } from "@/server/auth/current-user";
import * as scheduleService from "@/server/services/schedule.service";
import { saveAttachmentUpload } from "@/server/services/storage";
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

const scheduleTypeSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da escala."),
  workDays: z.coerce.number().int().min(1, "Informe os dias de trabalho."),
  restDays: z.coerce.number().int().min(1, "Informe os dias de folga."),
});

function parseScheduleTypeForm(formData: FormData) {
  return scheduleTypeSchema.parse({
    name: formData.get("name"),
    workDays: formData.get("workDays"),
    restDays: formData.get("restDays"),
  });
}

export async function createScheduleTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseScheduleTypeForm(formData);
    await scheduleService.createScheduleType(user, data);
    revalidatePath("/cadastros/escalas");
  });
}

export async function updateScheduleTypeAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseScheduleTypeForm(formData);
    await scheduleService.updateScheduleType(user, id, data);
    revalidatePath("/cadastros/escalas");
  });
}

export async function setScheduleTypeActiveAction(id: string, active: boolean) {
  const user = await requireUser();
  await scheduleService.setScheduleTypeActive(user, id, active);
  revalidatePath("/cadastros/escalas");
}

const turnoSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do turno."),
  scheduleTypeId: z.string().min(1, "Selecione o tipo de escala."),
  startDate: z.string().min(1, "Informe a data de início do ciclo."),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
});

function parseTurnoForm(formData: FormData) {
  const parsed = turnoSchema.parse({
    name: formData.get("name"),
    scheduleTypeId: formData.get("scheduleTypeId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime") || null,
    endTime: formData.get("endTime") || null,
  });
  return {
    name: parsed.name,
    scheduleTypeId: parsed.scheduleTypeId,
    startDate: parseDateOnly(parsed.startDate),
    startTime: parsed.startTime,
    endTime: parsed.endTime,
  };
}

export async function createTurnoAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const data = parseTurnoForm(formData);
    await scheduleService.createTurno(user, data);
    revalidatePath("/cadastros/escalas");
    revalidatePath("/escalas");
  });
}

export async function updateTurnoAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const id = String(formData.get("id"));
    const data = parseTurnoForm(formData);
    await scheduleService.updateTurno(user, id, data);
    revalidatePath("/cadastros/escalas");
    revalidatePath("/escalas");
  });
}

export async function setCollaboratorTurnoAction(collaboratorId: string, turnoId: string | null) {
  const user = await requireUser();
  await scheduleService.setCollaboratorTurno(user, collaboratorId, turnoId);
  revalidatePath("/escalas");
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${collaboratorId}`);
}

const dayNoteSchema = z.object({
  collaboratorId: z.string().min(1),
  date: z.string().min(1),
  overrideStatus: z.enum(["TRABALHO", "FOLGA"]),
  status: z.enum(["FALTA", "ATESTADO", "FERIAS", "TROCA", "OUTRO"]).optional().nullable(),
  notes: z.string().trim().min(1, "Escreva uma observação."),
});

/** Anexo do atestado/documento é opcional e não deve desfazer o salvamento da observação se falhar. */
async function maybeAttachDayNoteFile(user: CurrentUser, dayNoteId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  try {
    const saved = await saveAttachmentUpload(file);
    await scheduleService.attachScheduleDayNoteFile(user, dayNoteId, saved);
  } catch (error) {
    console.error("Falha ao anexar arquivo da observação de escala:", error);
  }
}

export async function saveScheduleDayNoteAction(_prev: ActionResult, formData: FormData) {
  return toResult(async () => {
    const user = await requireUser();
    const parsed = dayNoteSchema.parse({
      collaboratorId: formData.get("collaboratorId"),
      date: formData.get("date"),
      overrideStatus: formData.get("overrideStatus"),
      status: formData.get("status") || null,
      notes: formData.get("notes"),
    });
    const note = await scheduleService.upsertScheduleDayNote(user, {
      collaboratorId: parsed.collaboratorId,
      date: parseDateOnly(parsed.date),
      overrideStatus: parsed.overrideStatus,
      status: parsed.status,
      notes: parsed.notes,
    });
    await maybeAttachDayNoteFile(user, note.id, formData);
    revalidatePath("/escalas");
  });
}

export async function deleteScheduleDayNoteAction(id: string) {
  const user = await requireUser();
  await scheduleService.deleteScheduleDayNote(user, id);
  revalidatePath("/escalas");
}
