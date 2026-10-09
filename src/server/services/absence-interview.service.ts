import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  employeeAnswersSchema,
  evaluationSchema,
  type EmployeeAnswers,
  type Evaluation,
} from "@/domain/absence-interview/form";

/**
 * Entrevista de Absenteísmo (Rev 03/24): uma por falta/atestado lançado. O RH pede; o colaborador (ou o RH por ele,
 * se a pessoa não tem login) faz o relato; o RH avalia e conclui — o que marca a "entrevista de ABS" da falta como feita.
 * As respostas podem envolver saúde e vida pessoal: só o próprio colaborador e o RH enxergam.
 */

const interviewInclude = {
  collaborator: { select: { id: true, name: true, matricula: true, userId: true, area: { select: { name: true } }, function: { select: { name: true } } } },
  note: { select: { id: true, date: true, status: true, notes: true } },
  requestedBy: { select: { name: true } },
  answeredBy: { select: { name: true } },
  concludedBy: { select: { name: true } },
} as const;

export type InterviewDetail = NonNullable<Awaited<ReturnType<typeof loadInterview>>>;

function loadInterview(id: string) {
  return db.absenceInterview.findUnique({ where: { id }, include: interviewInclude });
}

async function ownCollaboratorId(user: CurrentUser): Promise<string | null> {
  const own = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
  return own?.id ?? null;
}

function isHr(user: CurrentUser) {
  return user.permissions.has(PERMISSIONS.HR_MANAGE);
}

/** Carrega a entrevista só se o usuário for do RH ou o próprio entrevistado. */
export async function getInterviewForUser(user: CurrentUser, id: string) {
  const interview = await loadInterview(id);
  if (!interview) return null;
  if (!isHr(user) && (await ownCollaboratorId(user)) !== interview.collaboratorId) throw new ForbiddenError();
  return { interview, asHr: isHr(user) };
}

/** RH pede a entrevista de uma falta/atestado lançado (idempotente: se já existe, devolve a mesma). */
export async function requestInterview(user: CurrentUser, noteId: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const note = await db.scheduleDayNote.findUniqueOrThrow({ where: { id: noteId } });
  if (note.status !== "FALTA" && note.status !== "ATESTADO") throw new Error("Só falta ou atestado tem entrevista de ABS.");
  const existing = await db.absenceInterview.findUnique({ where: { scheduleDayNoteId: noteId } });
  if (existing) return existing;
  const created = await db.absenceInterview.create({
    data: { scheduleDayNoteId: noteId, collaboratorId: note.collaboratorId, requestedById: user.id },
  });
  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "AbsenceInterview",
    entityId: created.id,
    newValue: { noteId, collaboratorId: note.collaboratorId },
  });
  return created;
}

/** Relato (parte A). O próprio colaborador envia o dele; o RH pode preencher por quem não tem login. */
export async function submitAnswers(user: CurrentUser, id: string, input: unknown) {
  const answers: EmployeeAnswers = employeeAnswersSchema.parse(input);
  const interview = await db.absenceInterview.findUniqueOrThrow({ where: { id } });
  if (interview.status === "CONCLUIDA") throw new Error("Esta entrevista já foi concluída pelo RH.");

  const own = (await ownCollaboratorId(user)) === interview.collaboratorId;
  if (!own && !isHr(user)) throw new ForbiddenError();

  await db.absenceInterview.update({
    where: { id },
    data: {
      answers,
      status: "RESPONDIDA",
      filledByHr: !own,
      answeredAt: new Date(),
      answeredById: user.id,
    },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "AbsenceInterview",
    entityId: id,
    newValue: { answered: true, filledByHr: !own },
  });
}

/** Avaliação (parte B) — só RH. Conclui a entrevista e marca a "entrevista de ABS" da falta/atestado como feita. */
export async function concludeInterview(user: CurrentUser, id: string, input: unknown) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const evaluation: Evaluation = evaluationSchema.parse(input);
  const interview = await db.absenceInterview.findUniqueOrThrow({ where: { id } });
  if (!interview.answers) throw new Error("Falta o relato do colaborador (parte A) antes de concluir.");

  await db.$transaction([
    db.absenceInterview.update({
      where: { id },
      data: {
        status: "CONCLUIDA",
        classification: evaluation.classification,
        actionTaken: evaluation.actionTaken,
        evaluation,
        concludedAt: new Date(),
        concludedById: user.id,
      },
    }),
    db.scheduleDayNote.update({ where: { id: interview.scheduleDayNoteId }, data: { absenceInterviewDone: true } }),
  ]);
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "AbsenceInterview",
    entityId: id,
    newValue: { concluded: true, classification: evaluation.classification, actionTaken: evaluation.actionTaken },
  });
}

/** Reabre uma entrevista concluída (volta a ser editável) e desmarca a entrevista de ABS da falta. */
export async function reopenInterview(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const interview = await db.absenceInterview.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.absenceInterview.update({ where: { id }, data: { status: "RESPONDIDA", concludedAt: null, concludedById: null } }),
    db.scheduleDayNote.update({ where: { id: interview.scheduleDayNoteId }, data: { absenceInterviewDone: false } }),
  ]);
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "AbsenceInterview", entityId: id, newValue: { reopened: true } });
}

/** Entrevistas do próprio colaborador logado. */
export async function listMyInterviews(user: CurrentUser) {
  const collaboratorId = await ownCollaboratorId(user);
  if (!collaboratorId) return [];
  return db.absenceInterview.findMany({
    where: { collaboratorId },
    include: { note: { select: { date: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Quantas entrevistas aguardam o relato do próprio colaborador (aviso no menu/perfil). */
export async function countMyPendingInterviews(user: CurrentUser): Promise<number> {
  const collaboratorId = await ownCollaboratorId(user);
  if (!collaboratorId) return 0;
  try {
    return await db.absenceInterview.count({ where: { collaboratorId, status: "SOLICITADA" } });
  } catch {
    return 0;
  }
}

/** Lista do RH (todas as entrevistas). */
export async function listInterviewsForHr(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  return db.absenceInterview.findMany({
    include: {
      collaborator: { select: { id: true, name: true, area: { select: { name: true } } } },
      note: { select: { date: true, status: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

/** Entrevistas por falta/atestado (pra mostrar o estado na fila de pendências do RH). Tolera tabela ausente. */
export async function interviewStateByNote(noteIds: string[]) {
  if (noteIds.length === 0) return new Map<string, { id: string; status: "SOLICITADA" | "RESPONDIDA" | "CONCLUIDA" }>();
  try {
    const rows = await db.absenceInterview.findMany({
      where: { scheduleDayNoteId: { in: noteIds } },
      select: { id: true, status: true, scheduleDayNoteId: true },
    });
    return new Map(rows.map((r) => [r.scheduleDayNoteId, { id: r.id, status: r.status }]));
  } catch (error) {
    console.error("[absence-interview] tabela indisponível:", error);
    return new Map();
  }
}
