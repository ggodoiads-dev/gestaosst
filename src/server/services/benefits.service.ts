import "server-only";
import { db } from "@/server/db";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { assessmentWindow, daysInMonth } from "@/domain/benefits/benefit-calendar";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export type MonthlyBenefit = {
  collaboratorId: string;
  collaboratorName: string;
  matricula: string | null;
  scheduledDays: number;
  unjustifiedFaltas: number;
  benefitDays: number;
  hasWarning: boolean;
  cestaBasica: boolean;
};

/**
 * Pra cada colaborador ativo: quantos dias de trabalho ele tem no mês-alvo (conforme a escala,
 * mês cheio) menos as faltas sem justificativa apuradas na janela de 21 a 20 — e se ele mantém
 * direito à cesta básica do mês (perde o mês inteiro se houve falta injustificada OU advertência
 * na mesma janela).
 */
export async function getMonthlyBenefits(user: CurrentUser, params: { month: number; year: number }): Promise<MonthlyBenefit[]> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const collaborators = await db.collaborator.findMany({
    where: { active: true },
    include: { turno: { include: { scheduleType: true } } },
    orderBy: { name: "asc" },
  });
  const collaboratorIds = collaborators.map((c) => c.id);

  const { from, toExclusive } = assessmentWindow(params.month, params.year);

  const [faltaNotes, warnings] = await Promise.all([
    db.scheduleDayNote.findMany({
      where: { collaboratorId: { in: collaboratorIds }, status: "FALTA", date: { gte: from, lt: toExclusive } },
      select: { collaboratorId: true },
    }),
    db.warning.findMany({
      where: { collaboratorId: { in: collaboratorIds }, date: { gte: from, lt: toExclusive } },
      select: { collaboratorId: true },
    }),
  ]);

  const faltasByCollaborator = new Map<string, number>();
  for (const note of faltaNotes) {
    faltasByCollaborator.set(note.collaboratorId, (faltasByCollaborator.get(note.collaboratorId) ?? 0) + 1);
  }
  const warnedCollaboratorIds = new Set(warnings.map((w) => w.collaboratorId));

  const totalDays = daysInMonth(params.month, params.year);

  return collaborators.map((collaborator) => {
    let scheduledDays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(params.year, params.month - 1, day);
      if (getCollaboratorDayStatus(date, collaborator) === "TRABALHO") scheduledDays++;
    }

    const unjustifiedFaltas = faltasByCollaborator.get(collaborator.id) ?? 0;
    const hasWarning = warnedCollaboratorIds.has(collaborator.id);

    return {
      collaboratorId: collaborator.id,
      collaboratorName: collaborator.name,
      matricula: collaborator.matricula,
      scheduledDays,
      unjustifiedFaltas,
      benefitDays: Math.max(scheduledDays - unjustifiedFaltas, 0),
      hasWarning,
      cestaBasica: unjustifiedFaltas === 0 && !hasWarning,
    };
  });
}
