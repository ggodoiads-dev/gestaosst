import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import {
  getCollaboratorDayStatus,
  cycleStartFromFirstRestDay,
  isSecondRestDayConsistent,
  type ScheduleDayComputedStatus,
} from "@/domain/schedule/schedule-calendar";
import { getMyCollaboratorProfile } from "@/server/services/productivity.service";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { ScheduleDayNoteStatus } from "@/generated/prisma/enums";

export type ScheduleTypeInput = {
  name: string;
  workDays: number;
  restDays: number;
};

export function listScheduleTypes(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  return db.scheduleType.findMany({ orderBy: { name: "asc" } });
}

export async function createScheduleType(user: CurrentUser, data: ScheduleTypeInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  const type = await db.scheduleType.create({ data });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "ScheduleType",
    entityId: type.id,
    newValue: data,
  });
  return type;
}

export async function updateScheduleType(user: CurrentUser, id: string, data: ScheduleTypeInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  const before = await db.scheduleType.findUniqueOrThrow({ where: { id } });
  const type = await db.scheduleType.update({ where: { id }, data });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "ScheduleType",
    entityId: id,
    previousValue: before,
    newValue: data,
  });
  return type;
}

export async function setScheduleTypeActive(user: CurrentUser, id: string, active: boolean) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  const before = await db.scheduleType.findUniqueOrThrow({ where: { id } });
  const type = await db.scheduleType.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: user.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "ScheduleType",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return type;
}

export type TurnoInput = {
  name: string;
  scheduleTypeId: string;
  startDate: Date;
  startTime?: string | null;
  endTime?: string | null;
};

/** Turnos ativos, com o tipo de escala já carregado — usado tanto na grade quanto no formulário de colaborador. */
export function listTurnos(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  return db.turno.findMany({ where: { active: true }, include: { scheduleType: true }, orderBy: { name: "asc" } });
}

/** Turnos ativos sem checagem de permissão — só id/name, pra popular selects (ex: tela de Acessos). */
export function listTurnosForSelect() {
  return db.turno.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function createTurno(user: CurrentUser, data: TurnoInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);

  const turno = await db.$transaction(async (tx) => {
    const created = await tx.turno.create({ data: { ...data, createdById: user.id } });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Turno", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return turno;
}

export async function updateTurno(user: CurrentUser, id: string, data: TurnoInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  const before = await db.turno.findUniqueOrThrow({ where: { id } });

  const turno = await db.$transaction(async (tx) => {
    const updated = await tx.turno.update({ where: { id }, data });
    await recordAudit(
      { userId: user.id, action: "UPDATE", entityType: "Turno", entityId: id, previousValue: before, newValue: data },
      tx,
    );
    return updated;
  });

  return turno;
}

export type CollaboratorScheduleInput = {
  turnoId: string | null;
  /** 1º dia de folga informado pelo operador — usado só pra calcular a data de início do ciclo
   * pessoal; não sobrescreve o ciclo atual quando null (troca de turno sem mexer no ciclo). */
  firstRestDate: Date | null;
  /** 2º dia de folga, opcional — só uma conferência de que as datas batem com o ciclo da escala. */
  secondRestDate: Date | null;
};

/**
 * Atribui (ou remove) o turno de um colaborador e, quando informado, o dia 1 do ciclo pessoal
 * (calculado a partir do 1º dia de folga que o operador de fato sabe de cabeça, em vez de uma
 * abstrata "data de início do ciclo") — usado no atalho da grade de escalas.
 */
export async function setCollaboratorSchedule(user: CurrentUser, collaboratorId: string, input: CollaboratorScheduleInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  const before = await db.collaborator.findUniqueOrThrow({ where: { id: collaboratorId } });

  let scheduleStartDate = before.scheduleStartDate;
  if (!input.turnoId) {
    scheduleStartDate = null;
  } else if (input.firstRestDate) {
    const turno = await db.turno.findUniqueOrThrow({ where: { id: input.turnoId }, include: { scheduleType: true } });
    if (
      input.secondRestDate &&
      !isSecondRestDayConsistent(
        input.firstRestDate,
        input.secondRestDate,
        turno.scheduleType.workDays,
        turno.scheduleType.restDays,
      )
    ) {
      throw new Error("O segundo dia de folga não é consistente com o primeiro pra essa escala. Confira as datas.");
    }
    scheduleStartDate = cycleStartFromFirstRestDay(input.firstRestDate, turno.scheduleType.workDays);
  }

  const collaborator = await db.collaborator.update({
    where: { id: collaboratorId },
    data: { turnoId: input.turnoId, scheduleStartDate },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Collaborator",
    entityId: collaboratorId,
    previousValue: { turnoId: before.turnoId, scheduleStartDate: before.scheduleStartDate },
    newValue: { turnoId: input.turnoId, scheduleStartDate },
  });
  return collaborator;
}

export type ScheduleDayNoteInput = {
  collaboratorId: string;
  date: Date;
  overrideStatus: ScheduleDayComputedStatus;
  status?: ScheduleDayNoteStatus | null;
  notes: string;
};

export async function upsertScheduleDayNote(user: CurrentUser, data: ScheduleDayNoteInput) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);

  return db.scheduleDayNote.upsert({
    where: { collaboratorId_date: { collaboratorId: data.collaboratorId, date: data.date } },
    update: { overrideStatus: data.overrideStatus, status: data.status, notes: data.notes },
    create: {
      collaboratorId: data.collaboratorId,
      date: data.date,
      overrideStatus: data.overrideStatus,
      status: data.status,
      notes: data.notes,
      createdById: user.id,
    },
  });
}

export async function deleteScheduleDayNote(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  await db.scheduleDayNote.delete({ where: { id } });
}

/** Anexa um arquivo (ex: atestado) a uma observação de dia — mantém histórico, nunca substitui. */
export async function attachScheduleDayNoteFile(
  user: CurrentUser,
  dayNoteId: string,
  file: { filename: string; path: string; mimeType: string; size: number },
) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);
  return db.attachment.create({
    data: {
      filename: file.filename,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      context: "ESCALA",
      scheduleDayNoteId: dayNoteId,
      uploadedById: user.id,
    },
  });
}

export type DayCell = {
  date: Date;
  computed: ScheduleDayComputedStatus;
  note:
    | {
        id: string;
        status: ScheduleDayNoteStatus | null;
        notes: string;
        overrideStatus: ScheduleDayComputedStatus;
        attachments: { id: string; filename: string; path: string }[];
      }
    | null;
};

/** Chave local (não UTC) de um dia, para casar `ScheduleDayNote.date` com os dias da grade
 * independente do horário-do-dia gravado — evita o off-by-one de `toISOString()` em fusos
 * atrás de UTC (mesmo cuidado de `parseDateOnly` em `src/lib/dates.ts`). */
function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Grade mensal: para cada colaborador ativo, o status do turno (ou a exceção lançada) de cada dia do mês. */
export async function getScheduleGrid(user: CurrentUser, params: { month: number; year: number; areaId?: string }) {
  requirePermission(user, PERMISSIONS.SCHEDULE_MANAGE);

  const monthStart = new Date(params.year, params.month - 1, 1);
  const daysInMonth = new Date(params.year, params.month, 0).getDate();
  const nextMonthStart = new Date(params.year, params.month, 1); // limite exclusivo

  const collaborators = await db.collaborator.findMany({
    where: { active: true, areaId: params.areaId || undefined },
    include: { turno: { include: { scheduleType: true } }, function: true },
    orderBy: { name: "asc" },
  });

  const collaboratorIds = collaborators.map((c) => c.id);

  const notes =
    collaboratorIds.length > 0
      ? await db.scheduleDayNote.findMany({
          where: { collaboratorId: { in: collaboratorIds }, date: { gte: monthStart, lt: nextMonthStart } },
          include: { attachments: { orderBy: { uploadedAt: "desc" } } },
        })
      : [];

  const notesByKey = new Map<string, (typeof notes)[number]>();
  for (const note of notes) {
    notesByKey.set(`${note.collaboratorId}-${localDateKey(note.date)}`, note);
  }

  const rows = collaborators.map((collaborator) => {
    const days: DayCell[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(params.year, params.month - 1, day);
      const note = notesByKey.get(`${collaborator.id}-${localDateKey(date)}`) ?? null;
      const computed = getCollaboratorDayStatus(date, collaborator);
      days.push({
        date,
        computed: note ? note.overrideStatus : computed,
        note: note
          ? {
              id: note.id,
              status: note.status,
              notes: note.notes,
              overrideStatus: note.overrideStatus,
              attachments: note.attachments.map((a) => ({ id: a.id, filename: a.filename, path: a.path })),
            }
          : null,
      });
    }

    return { collaborator, turno: collaborator.turno, days };
  });

  return { rows, daysInMonth };
}

/** Escala do próprio colaborador logado num mês — mesma lógica de `getScheduleGrid`, só que
 * pra um colaborador em vez da grade inteira. `null` se o usuário não estiver vinculado. */
export async function getMySchedule(user: CurrentUser, params: { month: number; year: number }) {
  requirePermission(user, PERMISSIONS.SCHEDULE_SELF_VIEW);
  const collaborator = await getMyCollaboratorProfile(user);
  if (!collaborator) return null;

  const monthStart = new Date(params.year, params.month - 1, 1);
  const daysInMonth = new Date(params.year, params.month, 0).getDate();
  const nextMonthStart = new Date(params.year, params.month, 1);

  const notes = await db.scheduleDayNote.findMany({
    where: { collaboratorId: collaborator.id, date: { gte: monthStart, lt: nextMonthStart } },
  });
  const notesByKey = new Map(notes.map((note) => [localDateKey(note.date), note]));

  const days: DayCell[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(params.year, params.month - 1, day);
    const note = notesByKey.get(localDateKey(date)) ?? null;
    const computed = getCollaboratorDayStatus(date, collaborator);
    days.push({
      date,
      computed: note ? note.overrideStatus : computed,
      note: note
        ? { id: note.id, status: note.status, notes: note.notes, overrideStatus: note.overrideStatus, attachments: [] }
        : null,
    });
  }

  return { collaborator, turno: collaborator.turno, days, daysInMonth };
}

/** Faltas/atestados lançados (via chamada ou manualmente) que ainda não tiveram advertência
 * aplicada e/ou entrevista de ABS feita — fila de trabalho de RH pra não deixar isso esquecido. */
export function listPendingAbsenceFollowUps(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  return db.scheduleDayNote.findMany({
    where: {
      status: { in: ["FALTA", "ATESTADO"] },
      OR: [{ warningApplied: false }, { absenceInterviewDone: false }],
    },
    include: { collaborator: true },
    orderBy: { date: "desc" },
  });
}

export async function markWarningApplied(user: CurrentUser, noteId: string, value: boolean) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  await db.scheduleDayNote.update({ where: { id: noteId }, data: { warningApplied: value } });
}

export async function markAbsenceInterviewDone(user: CurrentUser, noteId: string, value: boolean) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  await db.scheduleDayNote.update({ where: { id: noteId }, data: { absenceInterviewDone: value } });
}
