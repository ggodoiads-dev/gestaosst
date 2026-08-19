import "server-only";
import { startOfDay } from "date-fns";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { ScheduleDayNoteStatus } from "@/generated/prisma/enums";

/** Todo colaborador ativo se o usuário tem SCHEDULE_MANAGE; senão só os das áreas (e, se
 * definido, dos turnos) marcados como "Faz chamada?" pra esse usuário em Acessos — funciona
 * independente do Role/perfil (um Colaborador comum pode ter `canRollCall`). */
function scopeWhere(user: CurrentUser) {
  if (hasPermission(user, PERMISSIONS.SCHEDULE_MANAGE)) return {};
  if (!user.canRollCall) throw new ForbiddenError();

  const areaIds = Array.from(user.rollCallAreaIds);
  if (areaIds.length === 0) {
    throw new ForbiddenError("Nenhuma área configurada pra sua chamada — peça pro administrador configurar em Acessos.");
  }
  const turnoIds = Array.from(user.rollCallTurnoIds);
  return {
    areaId: { in: areaIds },
    ...(turnoIds.length > 0 ? { turnoId: { in: turnoIds } } : {}),
  };
}

export type RollCallEntry = {
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
      };
    })
    .filter((entry) => entry.computed === "TRABALHO")
    .map(({ collaborator, existingNote }) => ({ collaborator, existingNote }));
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
    where: { ...where, id: { in: collaboratorIds } },
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
