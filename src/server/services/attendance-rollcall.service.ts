import "server-only";
import { startOfDay } from "date-fns";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { ScheduleDayNoteStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type RollCallCollaboratorWhere = Prisma.CollaboratorWhereInput;

/** Áreas (e, se definido, turnos) marcados como "Faz chamada?" pra esse usuário em Acessos —
 * `null` quando não tem nada configurado. Exportada pra Produtividade reaproveitar: o pedido do
 * negócio é que quem lança produtividade da equipe seja exatamente quem já faz a chamada, com o
 * mesmo escopo configurado uma vez só em Acessos, em vez de um critério próprio (função liderada). */
export function rollCallCollaboratorWhere(user: CurrentUser): RollCallCollaboratorWhere | null {
  const parts: RollCallCollaboratorWhere[] = [];

  const areaIds = Array.from(user.rollCallAreaIds);
  if (areaIds.length > 0) {
    const turnoIds = Array.from(user.rollCallTurnoIds);
    parts.push({ areaId: { in: areaIds }, ...(turnoIds.length > 0 ? { turnoId: { in: turnoIds } } : {}) });
  }

  // Pessoas escolhidas uma a uma em Usuários e Permissões — somam ao escopo por área/turno.
  const collaboratorIds = Array.from(user.rollCallCollaboratorIds);
  if (collaboratorIds.length > 0) parts.push({ id: { in: collaboratorIds } });

  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : { OR: parts };
}

/** Todo colaborador ativo se o usuário tem SCHEDULE_MANAGE; senão só os das áreas (e, se
 * definido, dos turnos) marcados como "Faz chamada?" pra esse usuário em Acessos — funciona
 * independente do Role/perfil (um Colaborador comum pode ter `canRollCall`). */
function scopeWhere(user: CurrentUser) {
  if (hasPermission(user, PERMISSIONS.SCHEDULE_MANAGE)) return {};
  if (!user.canRollCall) throw new ForbiddenError();

  const where = rollCallCollaboratorWhere(user);
  if (!where) {
    throw new ForbiddenError("Nenhuma área ou pessoa configurada pra sua chamada — peça pro administrador configurar em Usuários e Permissões.");
  }
  return where;
}

export type RollCallEntry = {
  /** Escolhido pessoalmente pro usuário, mas de folga hoje pela escala — aparece mesmo assim. */
  offToday: boolean;
  collaborator: { id: string; name: string; functionName: string | null };
  existingNote: { status: ScheduleDayNoteStatus | null; notes: string } | null;
};

/** Colaboradores escalados pra trabalhar hoje, dentro do escopo do usuário — base da tela de
 * chamada. Já mostra se algum já tem uma observação lançada hoje (ex: RH já registrou de outro jeito). */
export async function getTodayRollCall(user: CurrentUser): Promise<RollCallEntry[]> {
  const where = scopeWhere(user);
  const today = startOfDay(new Date());

  const collaborators = await db.collaborator.findMany({
    where: { ...where, active: true },
    include: { turno: { include: { scheduleType: true } }, function: true },
    orderBy: { name: "asc" },
  });

  const collaboratorIds = collaborators.map((c) => c.id);
  const notes =
    collaboratorIds.length > 0
      ? await db.scheduleDayNote.findMany({ where: { collaboratorId: { in: collaboratorIds }, date: today } })
      : [];
  const notesByCollaborator = new Map(notes.map((n) => [n.collaboratorId, n]));

  return collaborators
    .map((collaborator) => {
      const note = notesByCollaborator.get(collaborator.id) ?? null;
      const computed = note ? note.overrideStatus : getCollaboratorDayStatus(today, collaborator);
      return {
        collaborator: { id: collaborator.id, name: collaborator.name, functionName: collaborator.function?.name ?? null },
        existingNote: note ? { status: note.status, notes: note.notes } : null,
        computed,
        picked: user.rollCallCollaboratorIds.has(collaborator.id),
      };
    })
    // Quem veio do escopo por área/turno só entra se está escalado pra hoje; quem o administrador
    // escolheu pessoalmente entra sempre (marcado "folga hoje" se for o caso) — era o que fazia a
    // chamada "não mostrar todo mundo".
    .filter((entry) => entry.computed === "TRABALHO" || entry.picked)
    .map(({ collaborator, existingNote, computed }) => ({ collaborator, existingNote, offToday: computed !== "TRABALHO" }));
}

export type RollCallSubmission = {
  collaboratorId: string;
  absent: boolean;
  status?: Extract<ScheduleDayNoteStatus, "FALTA" | "ATESTADO" | "OUTRO">;
  notes?: string;
};

/** Registra a chamada de hoje — cada colaborador marcado como ausente vira uma observação na
 * escala (mesmo mecanismo que RH já usa manualmente), sem mexer em quem está presente. */
export async function submitRollCall(user: CurrentUser, entries: RollCallSubmission[]) {
  const where = scopeWhere(user);
  const today = startOfDay(new Date());

  const absentEntries = entries.filter((e) => e.absent);
  if (absentEntries.length === 0) return;

  const collaboratorIds = absentEntries.map((e) => e.collaboratorId);
  const allowedCollaborators = await db.collaborator.findMany({
    where: { AND: [where, { id: { in: collaboratorIds } }] },
    select: { id: true },
  });
  const allowedIds = new Set(allowedCollaborators.map((c) => c.id));

  for (const entry of absentEntries) {
    if (!allowedIds.has(entry.collaboratorId)) {
      throw new ForbiddenError("Você não pode registrar chamada para esse colaborador.");
    }
  }

  await db.$transaction(
    absentEntries.map((entry) =>
      db.scheduleDayNote.upsert({
        where: { collaboratorId_date: { collaboratorId: entry.collaboratorId, date: today } },
        update: {
          overrideStatus: "FOLGA",
          status: entry.status ?? "FALTA",
          notes: entry.notes || "Registrado via chamada.",
        },
        create: {
          collaboratorId: entry.collaboratorId,
          date: today,
          overrideStatus: "FOLGA",
          status: entry.status ?? "FALTA",
          notes: entry.notes || "Registrado via chamada.",
          createdById: user.id,
        },
      }),
    ),
  );
}
