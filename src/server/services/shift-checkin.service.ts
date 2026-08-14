import "server-only";
import { startOfDay } from "date-fns";
import { db } from "@/server/db";
import { getDayStatus } from "@/domain/schedule/schedule-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

function findMyCollaborator(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.SHIFT_CHECKIN_SELF);
  return db.collaborator.findUnique({
    where: { userId: user.id },
    include: { turno: { include: { scheduleType: true } } },
  });
}

/** Colaborador vinculado ao usuário logado, exigindo que exista (usado ao confirmar presença). */
async function requireMyCollaborator(user: CurrentUser) {
  const collaborator = await findMyCollaborator(user);
  if (!collaborator) {
    throw new ForbiddenError("Seu usuário ainda não está vinculado a um colaborador.");
  }
  return collaborator;
}

type CollaboratorWithTurno = {
  id: string;
  turno: { startDate: Date; scheduleType: { workDays: number; restDays: number } } | null;
};

/** Situação do turno de hoje de um colaborador (trabalho/folga) + se já foi confirmada presença. */
async function computeTodayCheckIn<T extends CollaboratorWithTurno>(collaborator: T) {
  const today = startOfDay(new Date());

  const [note, checkIn] = await Promise.all([
    db.scheduleDayNote.findUnique({ where: { collaboratorId_date: { collaboratorId: collaborator.id, date: today } } }),
    db.shiftCheckIn.findUnique({ where: { collaboratorId_date: { collaboratorId: collaborator.id, date: today } } }),
  ]);

  const computed = collaborator.turno
    ? getDayStatus(today, collaborator.turno.startDate, collaborator.turno.scheduleType.workDays, collaborator.turno.scheduleType.restDays)
    : "FOLGA";
  const status = note ? note.overrideStatus : computed;

  return { collaborator, date: today, status, checkedIn: !!checkIn, checkedInAt: checkIn?.checkedInAt ?? null };
}

/** Status do turno de hoje do colaborador logado + se ele já confirmou presença — `null` se o
 * usuário logado ainda não está vinculado a um colaborador. */
export async function getMyShiftCheckInToday(user: CurrentUser) {
  const collaborator = await findMyCollaborator(user);
  if (!collaborator) return null;
  return computeTodayCheckIn(collaborator);
}

export async function confirmMyShiftCheckIn(user: CurrentUser) {
  const collaborator = await requireMyCollaborator(user);
  const today = startOfDay(new Date());

  await db.shiftCheckIn.upsert({
    where: { collaboratorId_date: { collaboratorId: collaborator.id, date: today } },
    create: { collaboratorId: collaborator.id, date: today },
    update: {},
  });
}

/** Status do turno de hoje de QUALQUER colaborador — pro gestor ver antes de confirmar por ele. */
export async function getShiftCheckInStatusFor(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.SHIFT_CHECKIN_MANAGE);
  const collaborator = await db.collaborator.findUniqueOrThrow({
    where: { id: collaboratorId },
    include: { turno: { include: { scheduleType: true } } },
  });
  return computeTodayCheckIn(collaborator);
}

/** Gestor confirma a presença de hoje em nome de um colaborador que esqueceu de fazer isso. */
export async function confirmShiftCheckInFor(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.SHIFT_CHECKIN_MANAGE);
  const today = startOfDay(new Date());

  await db.shiftCheckIn.upsert({
    where: { collaboratorId_date: { collaboratorId, date: today } },
    create: { collaboratorId, date: today },
    update: {},
  });
}

/** Desfaz uma confirmação de presença de hoje feita por engano. */
export async function removeShiftCheckInFor(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.SHIFT_CHECKIN_MANAGE);
  const today = startOfDay(new Date());
  await db.shiftCheckIn.deleteMany({ where: { collaboratorId, date: today } });
}
