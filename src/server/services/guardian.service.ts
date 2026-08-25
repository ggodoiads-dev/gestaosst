import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { GuardianReportType } from "@/generated/prisma/enums";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";

export { GUARDIAN_TYPE_LABELS };

export function listGuardianReportsForUser(
  user: CurrentUser,
  filters: { type?: GuardianReportType; collaboratorId?: string } = {},
) {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);
  return db.guardianReport.findMany({
    where: { type: filters.type, reporterCollaboratorId: filters.collaboratorId },
    include: { reporterCollaborator: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
  });
}

export type GuardianAdherence = {
  activeCollaboratorsCount: number;
  reportedCount: number;
  neverReportedCount: number;
  adherencePercent: number;
  byType: { type: GuardianReportType; count: number }[];
  topReporters: { collaboratorId: string; name: string; count: number }[];
};

/** Adesão ao Guardian: dos colaboradores ativos, quantos já relataram pelo menos uma vez (de
 * qualquer tipo) vs. quantos nunca usaram a ferramenta — indicador de participação, não de
 * qualidade dos relatos. */
export async function getGuardianAdherence(user: CurrentUser): Promise<GuardianAdherence> {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  const [activeCollaborators, reports] = await Promise.all([
    db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true } }),
    db.guardianReport.findMany({
      where: { reporterCollaboratorId: { not: null } },
      select: { type: true, reporterCollaboratorId: true },
    }),
  ]);

  const activeIds = new Set(activeCollaborators.map((c) => c.id));
  const countByCollaborator = new Map<string, number>();
  const byTypeCount = new Map<GuardianReportType, number>();

  for (const r of reports) {
    if (!r.reporterCollaboratorId || !activeIds.has(r.reporterCollaboratorId)) continue;
    countByCollaborator.set(r.reporterCollaboratorId, (countByCollaborator.get(r.reporterCollaboratorId) ?? 0) + 1);
    byTypeCount.set(r.type, (byTypeCount.get(r.type) ?? 0) + 1);
  }

  const reportedCount = countByCollaborator.size;
  const nameById = new Map(activeCollaborators.map((c) => [c.id, c.name]));
  const topReporters = Array.from(countByCollaborator.entries())
    .map(([collaboratorId, count]) => ({ collaboratorId, name: nameById.get(collaboratorId) ?? "?", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    activeCollaboratorsCount: activeCollaborators.length,
    reportedCount,
    neverReportedCount: activeCollaborators.length - reportedCount,
    adherencePercent: activeCollaborators.length > 0 ? Math.round((reportedCount / activeCollaborators.length) * 100) : 0,
    byType: Array.from(byTypeCount.entries()).map(([type, count]) => ({ type, count })),
    topReporters,
  };
}

/** Relatos que EU fiz como relator — nunca os que fui "relatado" (decisão do negócio: o Meu
 * Perfil mostra sua participação com a ferramenta, não ocorrências abertas sobre você). */
export async function listMyGuardianReports(user: CurrentUser) {
  const collaborator = await db.collaborator.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!collaborator) return [];

  return db.guardianReport.findMany({
    where: { reporterCollaboratorId: collaborator.id },
    orderBy: { occurredAt: "desc" },
  });
}
