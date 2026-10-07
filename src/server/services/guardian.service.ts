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
  month: string;
  activeCollaboratorsCount: number;
  reportedCount: number;
  notReportedCount: number;
  adherencePercent: number;
  byType: { type: GuardianReportType; count: number }[];
  topReporters: { collaboratorId: string; name: string; count: number }[];
  notReported: { collaboratorId: string; name: string }[];
};

export type GuardianMonthSummary = {
  month: string;
  activeCollaboratorsCount: number;
  reportedCount: number;
  adherencePercent: number;
  reportsCount: number;
};

/** "2026-10" do mês corrente (fuso de Brasília). */
export function currentMonthKey(now = new Date()): string {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Os horários do Guardian são gravados "como estão na planilha" tratados como UTC (o servidor
 * roda em UTC), então os limites do mês também são em UTC — assim o relato de 30/09 às 23h
 * continua em setembro. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

type CollaboratorForAdherence = {
  id: string;
  name: string;
  active: boolean;
  admissionDate: Date | null;
  createdAt: Date;
  inactivatedAt: Date | null;
};

/** Quem conta no denominador de um mês: já estava na empresa (admissão, ou cadastro se não houver)
 * até o fim do mês e não tinha sido desligado antes do começo dele. É isso que mantém a "memória"
 * dos meses fechados — um desligamento de hoje não muda a adesão de setembro. Desligado sem data
 * de desligamento (cadastro antigo) só conta se ainda estiver ativo. */
function wasActiveDuring(c: CollaboratorForAdherence, start: Date, end: Date, isCurrentMonth: boolean): boolean {
  const joined = c.admissionDate ?? c.createdAt;
  if (joined >= end) return false;
  if (c.active) return true;
  // Mês em andamento: só conta quem está ativo agora (quem já saiu não tem mais o que cobrar).
  if (isCurrentMonth) return false;
  return !!c.inactivatedAt && c.inactivatedAt >= start;
}

type ReportForAdherence = { type: GuardianReportType; reporterCollaboratorId: string | null; at: Date };

function summarizeMonth(month: string, collaborators: CollaboratorForAdherence[], reports: ReportForAdherence[]) {
  const { start, end } = monthRange(month);
  const inMonth = collaborators.filter((c) => wasActiveDuring(c, start, end, month === currentMonthKey()));
  const ids = new Set(inMonth.map((c) => c.id));
  const monthReports = reports.filter((r) => r.at >= start && r.at < end && r.reporterCollaboratorId && ids.has(r.reporterCollaboratorId));
  const countByCollaborator = new Map<string, number>();
  const byType = new Map<GuardianReportType, number>();
  for (const r of monthReports) {
    countByCollaborator.set(r.reporterCollaboratorId!, (countByCollaborator.get(r.reporterCollaboratorId!) ?? 0) + 1);
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  }
  return { inMonth, countByCollaborator, byType, reportsCount: monthReports.length };
}

/** Adesão ao Guardian por mês: dos colaboradores que estavam ativos naquele mês, quantos relataram
 * pelo menos uma vez (qualquer tipo). É calculada na hora a partir dos relatos já gravados — então
 * fica sempre atualizada com o que foi importado e cada mês fechado continua consultável. */
export async function getGuardianAdherence(
  user: CurrentUser,
  month: string = currentMonthKey(),
): Promise<{ selected: GuardianAdherence; history: GuardianMonthSummary[] }> {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  const [collaborators, rawReports] = await Promise.all([
    db.collaborator.findMany({
      select: { id: true, name: true, active: true, admissionDate: true, createdAt: true, inactivatedAt: true },
    }),
    db.guardianReport.findMany({
      where: { reporterCollaboratorId: { not: null } },
      select: { type: true, reporterCollaboratorId: true, occurredAt: true, reportedAt: true },
    }),
  ]);

  const reports: ReportForAdherence[] = rawReports.flatMap((r) => {
    const at = r.occurredAt ?? r.reportedAt;
    return at ? [{ type: r.type, reporterCollaboratorId: r.reporterCollaboratorId, at }] : [];
  });

  const months = new Set<string>([currentMonthKey(), month]);
  for (const r of reports) months.add(monthKeyOf(r.at));

  const history = Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .map((m) => {
      const s = summarizeMonth(m, collaborators, reports);
      const reportedCount = s.countByCollaborator.size;
      return {
        month: m,
        activeCollaboratorsCount: s.inMonth.length,
        reportedCount,
        adherencePercent: s.inMonth.length > 0 ? Math.round((reportedCount / s.inMonth.length) * 100) : 0,
        reportsCount: s.reportsCount,
      };
    });

  const s = summarizeMonth(month, collaborators, reports);
  const nameById = new Map(collaborators.map((c) => [c.id, c.name]));
  const reportedCount = s.countByCollaborator.size;

  const selected: GuardianAdherence = {
    month,
    activeCollaboratorsCount: s.inMonth.length,
    reportedCount,
    notReportedCount: s.inMonth.length - reportedCount,
    adherencePercent: s.inMonth.length > 0 ? Math.round((reportedCount / s.inMonth.length) * 100) : 0,
    byType: Array.from(s.byType.entries()).map(([type, count]) => ({ type, count })),
    topReporters: Array.from(s.countByCollaborator.entries())
      .map(([collaboratorId, count]) => ({ collaboratorId, name: nameById.get(collaboratorId) ?? "?", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    notReported: s.inMonth
      .filter((c) => !s.countByCollaborator.has(c.id))
      .map((c) => ({ collaboratorId: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };

  return { selected, history };
}

/** Relatos de um mês (pela data da ocorrência), mais recentes primeiro. */
export function listGuardianReportsOfMonth(user: CurrentUser, month: string) {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);
  const { start, end } = monthRange(month);
  return db.guardianReport.findMany({
    where: { OR: [{ occurredAt: { gte: start, lt: end } }, { occurredAt: null, reportedAt: { gte: start, lt: end } }] },
    include: { reporterCollaborator: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
  });
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
