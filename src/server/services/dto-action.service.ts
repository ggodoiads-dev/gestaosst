import "server-only";
import { addDays } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseDeadlineDays } from "@/domain/dto/deadline";
import type { ActionItemStatus } from "@/generated/prisma/enums";

/** Ações corretivas dos DTOs (sugeridas pelo Rico) — aparecem em Planos de Ação, na aba "Ações de DTO". */

export type DtoActionInput = { title: string; detail: string; owner: string; deadline: string };

/** Cria as linhas do plano de ação a partir das ações sugeridas, só se esse DTO ainda não tem nenhuma (idempotente).
 * Best-effort: se a tabela ainda não existir ou falhar, só registra no log — a sugestão em si continua valendo. */
export async function syncDtoActionRows(dtoId: string, actions: DtoActionInput[], now = new Date()): Promise<void> {
  if (actions.length === 0) return;
  try {
    const existing = await db.dtoAction.count({ where: { dtoEvaluationId: dtoId } });
    if (existing > 0) return;
    await db.dtoAction.createMany({
      data: actions.map((a) => ({
        dtoEvaluationId: dtoId,
        title: a.title,
        detail: a.detail,
        ownerRole: a.owner,
        deadlineLabel: a.deadline,
        dueDate: addDays(now, parseDeadlineDays(a.deadline)),
      })),
    });
  } catch (error) {
    console.error("[dto-action] não foi possível criar as ações no plano:", error);
  }
}

function requireView(user: CurrentUser) {
  if (!hasPermission(user, PERMISSIONS.ACTIONPLAN_MANAGE) && !hasPermission(user, PERMISSIONS.ACTIONPLAN_VIEW)) throw new ForbiddenError();
}

export type DtoActionRow = {
  id: string;
  title: string;
  detail: string;
  ownerRole: string;
  dueDate: Date;
  status: ActionItemStatus;
  cancelReason: string | null;
  collaboratorId: string;
  collaboratorName: string;
  activity: string;
  dtoDate: Date;
};

export async function listDtoActions(user: CurrentUser): Promise<DtoActionRow[]> {
  requireView(user);
  try {
    const rows = await db.dtoAction.findMany({
      include: { dtoEvaluation: { select: { collaboratorId: true, evaluatedName: true, activity: true, date: true } } },
      orderBy: [{ dueDate: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      ownerRole: r.ownerRole,
      dueDate: r.dueDate,
      status: r.status,
      cancelReason: r.cancelReason,
      collaboratorId: r.dtoEvaluation.collaboratorId,
      collaboratorName: r.dtoEvaluation.evaluatedName,
      activity: r.dtoEvaluation.activity,
      dtoDate: r.dtoEvaluation.date,
    }));
  } catch (error) {
    console.error("[dto-action] ações de DTO indisponíveis:", error);
    return [];
  }
}

export async function setDtoActionStatus(user: CurrentUser, id: string, status: ActionItemStatus, reason?: string | null) {
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);
  if (status === "VENCIDA") throw new Error("Status inválido.");
  const cancelReason = status === "CANCELADA" ? (reason ?? "").trim() : null;
  if (status === "CANCELADA" && cancelReason!.length < 5) throw new Error("Explique por que está cancelando (justificativa obrigatória).");
  const before = await db.dtoAction.findUniqueOrThrow({ where: { id } });
  const done = status === "CONCLUIDA";
  await db.dtoAction.update({
    where: { id },
    data: { status, completedAt: done ? new Date() : null, completedById: done ? user.id : null, cancelReason },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "DtoAction",
    entityId: id,
    previousValue: { status: before.status },
    newValue: { status, cancelReason },
  });
}
