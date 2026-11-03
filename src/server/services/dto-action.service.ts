import "server-only";
import { addDays } from "date-fns";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseDeadlineDays } from "@/domain/dto/deadline";
import { resolveOwnerNames } from "@/domain/dto/owners";
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
  /** Quem é o responsável, por nome (o cargo sugerido pelo Rico traduzido em gente). Vazio = fica só o cargo. */
  ownerNames: string[];
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
  const evaluation = {
    select: { collaboratorId: true, evaluatedName: true, evaluatorName: true, leaderName: true, activity: true, date: true, collaborator: { select: { areaId: true } } },
  } as const;
  try {
    // Se a coluna da justificativa de cancelamento ainda não existe no banco (migração pendente), ler TODAS as colunas falha e
    // a aba inteira ficava vazia. Aí lê só o essencial: as ações continuam aparecendo, só sem o texto do cancelamento.
    const rows = await db.dtoAction
      .findMany({ include: { dtoEvaluation: evaluation }, orderBy: [{ dueDate: "asc" }] })
      .catch(async () =>
        (
          await db.dtoAction.findMany({
            select: { id: true, title: true, detail: true, ownerRole: true, dueDate: true, status: true, dtoEvaluation: evaluation },
            orderBy: [{ dueDate: "asc" }],
          })
        ).map((r) => ({ ...r, cancelReason: null as string | null })),
      );
    // Pessoas que respondem por SST/RH e quem lidera cada área — pra trocar o cargo sugerido pelo nome.
    const [people, leaderUsers] = await Promise.all([
      db.collaborator.findMany({ where: { active: true }, select: { name: true, function: { select: { name: true } } } }),
      db.user.findMany({
        where: { active: true, canRollCall: true },
        select: { name: true, userRollCallAreas: { select: { areaId: true } } },
      }),
    ]);
    const byFunction = (test: (name: string) => boolean) => people.filter((p) => p.function && test(p.function.name.toLowerCase())).map((p) => p.name);
    const sstPeople = byFunction((n) => n.includes("segurança") || n.includes("seguranca"));
    const hrPeople = byFunction((n) => /\brh\b|recursos humanos/.test(n));
    const leadersByArea = new Map<string, string[]>();
    for (const u of leaderUsers) for (const a of u.userRollCallAreas) leadersByArea.set(a.areaId, [...(leadersByArea.get(a.areaId) ?? []), u.name]);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      ownerRole: r.ownerRole,
      ownerNames: resolveOwnerNames(r.ownerRole, {
        collaboratorName: r.dtoEvaluation.evaluatedName,
        leaderName: r.dtoEvaluation.leaderName,
        evaluatorName: r.dtoEvaluation.evaluatorName,
        areaLeaders: (r.dtoEvaluation.collaborator.areaId && leadersByArea.get(r.dtoEvaluation.collaborator.areaId)) || [],
        sstPeople,
        hrPeople,
      }),
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
  const before = await db.dtoAction.findUniqueOrThrow({ where: { id }, select: { status: true } });
  const done = status === "CONCLUIDA";
  await db.dtoAction.update({
    where: { id },
    data: {
      status,
      completedAt: done ? new Date() : null,
      completedById: done ? user.id : null,
      // Só mexe na coluna da justificativa quando ela importa (cancelando, ou reabrindo algo cancelado).
      ...(status === "CANCELADA" || before.status === "CANCELADA" ? { cancelReason } : {}),
    },
    select: { id: true },
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

/** Muda o status de várias ações de uma vez (o mesmo treinamento para vários colaboradores). Cada uma segue a regra de uma só. */
export async function setDtoActionsStatus(user: CurrentUser, ids: string[], status: ActionItemStatus, reason?: string | null) {
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);
  const unique = [...new Set(ids)].slice(0, 200);
  if (unique.length === 0) throw new Error("Nenhuma ação selecionada.");
  for (const id of unique) await setDtoActionStatus(user, id, status, reason);
  return unique.length;
}

/** Novo prazo (AAAA-MM-DD) das ações. Vale até o fim do dia no horário de Brasília; não aceita data que já passou. */
export async function rescheduleDtoActions(user: CurrentUser, ids: string[], dayKey: string, reason?: string | null) {
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new Error("Data inválida.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (dayKey < today) throw new Error("Escolha uma data a partir de hoje.");
  const dueDate = new Date(`${dayKey}T23:59:00-03:00`);
  if (Number.isNaN(dueDate.getTime())) throw new Error("Data inválida.");
  const unique = [...new Set(ids)].slice(0, 200);
  if (unique.length === 0) throw new Error("Nenhuma ação selecionada.");
  const rows = await db.dtoAction.findMany({ where: { id: { in: unique } }, select: { id: true, dueDate: true, status: true } });
  const open = rows.filter((r) => r.status !== "CONCLUIDA" && r.status !== "CANCELADA");
  if (open.length === 0) throw new Error("Só dá para reprogramar ação em aberto.");
  await db.dtoAction.updateMany({ where: { id: { in: open.map((r) => r.id) } }, data: { dueDate } });
  const note = (reason ?? "").trim().slice(0, 300) || null;
  for (const r of open) {
    await recordAudit({ userId: user.id, action: "UPDATE", entityType: "DtoAction", entityId: r.id, previousValue: { dueDate: r.dueDate }, newValue: { dueDate, reprogramada: true, motivo: note } });
  }
  return open.length;
}
