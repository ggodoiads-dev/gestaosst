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
      if (error instanceof Error) return { ok: false as const, error: error.message };
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
  usesTimeClock: z.string().optional(),
});

function parseTurnoForm(formData: FormData) {
  const parsed = turnoSchema.parse({
    name: formData.get("name"),
    scheduleTypeId: formData.get("scheduleTypeId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime") || null,
    endTime: formData.get("endTime") || null,
    usesTimeClock: formData.get("usesTimeClock") || undefined,
  });
  return {
    name: parsed.name,
    scheduleTypeId: parsed.scheduleTypeId,
    startDate: parseDateOnly(parsed.startDate),
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    usesTimeClock: parsed.usesTimeClock === "on",
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

export async function setCollaboratorScheduleAction(
  collaboratorId: string,
  input: { turnoId: string | null; firstRestDate: string | null; secondRestDate: string | null },
): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await scheduleService.setCollaboratorSchedule(user, collaboratorId, {
      turnoId: input.turnoId,
      firstRestDate: input.firstRestDate ? parseDateOnly(input.firstRestDate) : null,
      secondRestDate: input.secondRestDate ? parseDateOnly(input.secondRestDate) : null,
    });
    revalidatePath("/escalas");
    revalidatePath("/colaboradores");
    revalidatePath(`/colaboradores/${collaboratorId}`);
  });
}

const dayNoteSchema = z.object({
  collaboratorId: z.string().min(1),
  date: z.string().min(1),
  overrideStatus: z.enum(["TRABALHO", "FOLGA"]),
  status: z.enum(["FALTA", "ATESTADO", "FERIAS", "TROCA", "BH_MAIS", "BH_MENOS", "OUTRO"]).optional().nullable(),
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

export async function markWarningAppliedAction(noteId: string, value: boolean): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await scheduleService.markWarningApplied(user, noteId, value);
    revalidatePath("/pendencias-advertencia");
  });
}

export async function markAbsenceInterviewDoneAction(noteId: string, value: boolean): Promise<ActionResult> {
  return toResult(async () => {
    const user = await requireUser();
    await scheduleService.markAbsenceInterviewDone(user, noteId, value);
    revalidatePath("/pendencias-advertencia");
  });
}

export type VacationResult = { ok: true; message: string } | { ok: false; error: string };

const vacationSchema = z.object({
  collaboratorId: z.string().min(1, "Escolha o colaborador."),
  startKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o primeiro dia das férias."),
  days: z.coerce.number().int().min(1, "Informe os dias corridos de férias.").max(60, "No máximo 60 dias corridos."),
});

export async function registerVacationAction(input: { collaboratorId: string; startKey: string; days: number }): Promise<VacationResult> {
  try {
    const user = await requireUser();
    const parsed = vacationSchema.parse(input);
    const res = await scheduleService.registerVacation(user, parsed);
    revalidatePath("/escalas");
    revalidatePath("/chamada");
    const end = `${res.endKey.slice(8, 10)}/${res.endKey.slice(5, 7)}`;
    const back = `${res.returnKey.slice(8, 10)}/${res.returnKey.slice(5, 7)}`;
    const skipped = res.skipped.length > 0 ? ` ${res.skipped.length} dia(s) com falta ou atestado já lançado foram mantidos.` : "";
    return { ok: true, message: `Férias cadastradas até ${end}; volta em ${back}.${skipped}` };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dados inválidos." };
    if (error instanceof Error && /Informe o primeiro dia/.test(error.message)) return { ok: false, error: error.message };
    console.error("[escala] falha ao cadastrar férias:", error);
    return { ok: false, error: "Não foi possível cadastrar as férias." };
  }
}

export async function cancelVacationAction(collaboratorId: string, dateKey: string): Promise<VacationResult> {
  try {
    const user = await requireUser();
    const res = await scheduleService.cancelVacation(user, { collaboratorId, dateKey });
    revalidatePath("/escalas");
    revalidatePath("/chamada");
    return { ok: true, message: `${res.removed} dia(s) de férias removidos.` };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    if (error instanceof Error && /Esse dia não é de férias/.test(error.message)) return { ok: false, error: error.message };
    console.error("[escala] falha ao cancelar férias:", error);
    return { ok: false, error: "Não foi possível cancelar as férias." };
  }
}
