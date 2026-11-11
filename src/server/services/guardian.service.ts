import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { GuardianReportType } from "@/generated/prisma/enums";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import { isAdmTurno, isGoldenRule, isGuardianLeader, reportedPerson, type GoldenRuleOutcome } from "@/domain/guardian/golden-rule";

export { GUARDIAN_TYPE_LABELS };

/** Ver os relatos/indicadores: quem gerencia OU quem só pode visualizar (Auditor). Importar continua
 * exigindo `GUARDIAN_MANAGE` em guardian-import.service. */
function requireGuardianView(user: CurrentUser): void {
  if (!hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE) && !hasPermission(user, PERMISSIONS.GUARDIAN_VIEW)) {
    throw new ForbiddenError();
  }
}

export function listGuardianReportsForUser(
  user: CurrentUser,
  filters: { type?: GuardianReportType; collaboratorId?: string } = {},
) {
  requireGuardianView(user);
  return db.guardianReport.findMany({
    where: { type: filters.type, reporterCollaboratorId: filters.collaboratorId },
    include: { reporterCollaborator: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
  });
}

/** Os números de um grupo de pessoas (geral, operação ou liderança) num mês ou período. */
export type GuardianGroupDetail = {
  activeCollaboratorsCount: number;
  reportedCount: number;
  notReportedCount: number;
  adherencePercent: number;
  reportsCount: number;
  byType: { type: GuardianReportType; count: number }[];
  /** Todos que relataram no mês, do que mais relatou pro que menos (com o turno, pro ranking por turno). */
  ranking: { collaboratorId: string; name: string; count: number; turnoName: string | null }[];
  notReported: { collaboratorId: string; name: string; turnoName: string | null }[];
};

export type GuardianAdherence = GuardianGroupDetail & {
  month: string;
  /** Mês fechado com os valores congelados (o que ficou no último dia). */
  frozen: boolean;
  /** Data (AAAA-MM-DD) do último relato já importado, de qualquer mês: mostra até quando os dados chegam. */
  lastReportDay: string | null;
  /** A mesma conta separada: quem é liderança e quem é operação (o geral são os dois juntos). Fechamentos antigos não trazem. */
  groups?: { operacao: GuardianGroupDetail; lideranca: GuardianGroupDetail };
  /** Verdadeiro quando o mês está fechado mas a divisão liderança/operação foi calculada agora (o fechamento é de antes dela). */
  groupsLive?: boolean;
  /** Período filtrado (dentro do mês): quando existe, os números são só dos relatos desses dias e não são o fechamento do mês. */
  period?: { from: string; to: string } | null;
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

/** "2026-11-11" de hoje (fuso de Brasília). */
export function currentDayKey(now = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  turnoName: string | null;
  /** Liderança (pela configuração de cargos do Guardian) ou operação. */
  isLeader: boolean;
  active: boolean;
  admissionDate: Date | null;
  createdAt: Date;
  inactivatedAt: Date | null;
};

/** Quem conta no denominador de um mês: quem estava na casa no ÚLTIMO DIA do mês. Entrou (admissão, ou cadastro se não houver) até o fim do mês e
 * não saiu antes dele acabar. É a mesma regra do mês em andamento (quem já saiu não tem mais o que cobrar), então o mês que fecha termina exatamente
 * no valor em que estava; desligamento DEPOIS do fim do mês não mexe nele. Desligado sem data de desligamento (cadastro antigo) só conta se estiver ativo. */
function wasActiveDuring(
  c: Pick<CollaboratorForAdherence, "active" | "admissionDate" | "createdAt" | "inactivatedAt">,
  start: Date,
  end: Date,
  isCurrentMonth: boolean,
): boolean {
  const joined = c.admissionDate ?? c.createdAt;
  if (joined >= end) return false;
  if (c.active) return true;
  // Mês em andamento: só conta quem está ativo agora (quem já saiu não tem mais o que cobrar).
  if (isCurrentMonth) return false;
  // Mês fechado: quem saiu só depois do último dia do mês ainda estava lá no fechamento; quem saiu durante o mês não conta.
  return !!c.inactivatedAt && c.inactivatedAt >= end;
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

function buildGroupDetail(month: string, collaborators: CollaboratorForAdherence[], reports: ReportForAdherence[]): GuardianGroupDetail {
  const s = summarizeMonth(month, collaborators, reports);
  const nameById = new Map(collaborators.map((c) => [c.id, c.name]));
  const turnoById = new Map(collaborators.map((c) => [c.id, c.turnoName]));
  const reportedCount = s.countByCollaborator.size;
  return {
    activeCollaboratorsCount: s.inMonth.length,
    reportedCount,
    notReportedCount: s.inMonth.length - reportedCount,
    adherencePercent: s.inMonth.length > 0 ? Math.round((reportedCount / s.inMonth.length) * 100) : 0,
    reportsCount: s.reportsCount,
    byType: Array.from(s.byType.entries()).map(([type, count]) => ({ type, count })),
    ranking: Array.from(s.countByCollaborator.entries())
      .map(([collaboratorId, count]) => ({
        collaboratorId,
        name: nameById.get(collaboratorId) ?? "?",
        count,
        turnoName: turnoById.get(collaboratorId) ?? null,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")),
    notReported: s.inMonth
      .filter((c) => !s.countByCollaborator.has(c.id))
      .map((c) => ({ collaboratorId: c.id, name: c.name, turnoName: c.turnoName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function buildGroups(month: string, collaborators: CollaboratorForAdherence[], reports: ReportForAdherence[]) {
  return {
    operacao: buildGroupDetail(month, collaborators.filter((c) => !c.isLeader), reports),
    lideranca: buildGroupDetail(month, collaborators.filter((c) => c.isLeader), reports),
  };
}

function buildAdherenceDetail(month: string, collaborators: CollaboratorForAdherence[], reports: ReportForAdherence[], lastReportDay: string | null): GuardianAdherence {
  return {
    month,
    ...buildGroupDetail(month, collaborators, reports),
    frozen: false,
    lastReportDay,
    groups: buildGroups(month, collaborators, reports),
  };
}

/** Liderança no Guardian = todo o time do turno ADM, menos os cargos que a gestão marcou como operação (ex.: ajudante de armazém no ADM). Esses cargos
 * ficam guardados aqui; enquanto ninguém marcou, a sugestão é pelo nome do cargo. Leitura tolerante: sem a tabela no banco, vale a sugestão. */
async function loadLeadershipConfig(): Promise<{ configured: boolean; ids: Set<string> }> {
  try {
    const row = await db.guardianLeadershipConfig.findUnique({ where: { id: "default" } });
    if (row && Array.isArray(row.functionIds)) return { configured: true, ids: new Set(row.functionIds.filter((x): x is string => typeof x === "string")) };
  } catch (error) {
    console.error("[guardian] configuração de liderança indisponível:", error);
  }
  return { configured: false, ids: new Set() };
}

async function loadCollaboratorsForAdherence(): Promise<CollaboratorForAdherence[]> {
  const [rows, leadership] = await Promise.all([
    db.collaborator.findMany({
      select: { id: true, name: true, active: true, admissionDate: true, createdAt: true, inactivatedAt: true, functionId: true, function: { select: { name: true } }, turno: { select: { name: true } } },
    }),
    loadLeadershipConfig(),
  ]);
  return rows.map(({ turno, function: fn, functionId, ...c }) => ({
    ...c,
    turnoName: turno?.name ?? null,
    isLeader: isGuardianLeader({ turnoName: turno?.name ?? null, functionId, functionName: fn?.name ?? null }, leadership.configured ? leadership.ids : null),
  }));
}

/** Primeiro dia do mês seguinte (AAAA-MM-DD) — para saber se já há relato importado depois do fim do mês. */
function nextMonthStartDay(month: string): string {
  const { end } = monthRange(month);
  return end.toISOString().slice(0, 10);
}

/** Meses fechados já congelados. Leitura tolerante: se a tabela ainda não existir no banco, vale o cálculo na hora. */
async function loadSnapshots(): Promise<Map<string, GuardianAdherence>> {
  const map = new Map<string, GuardianAdherence>();
  try {
    const rows = await db.guardianMonthSnapshot.findMany();
    for (const r of rows) map.set(r.month, { ...(r.data as unknown as GuardianAdherence), frozen: true });
  } catch (error) {
    console.error("[guardian] fechamentos de mês indisponíveis:", error);
  }
  return map;
}

/** Adesão ao Guardian por mês: dos colaboradores que estavam na casa naquele mês, quantos relataram pelo menos uma vez (qualquer tipo). O mês em andamento
 * é calculado na hora e recomeça do zero a cada mês. Quando o mês FECHA (já há relato importado de depois dele) o resultado é congelado e não muda mais,
 * mesmo com cadastro novo, desligamento ou data editada; para recalcular um mês é preciso reabri-lo (`reopenGuardianMonth`). */
export async function getGuardianAdherence(
  user: CurrentUser,
  month: string = currentMonthKey(),
  period: { from: string; to: string } | null = null,
): Promise<{ selected: GuardianAdherence; history: GuardianMonthSummary[] }> {
  requireGuardianView(user);

  const [collaborators, rawReports] = await Promise.all([
    loadCollaboratorsForAdherence(),
    db.guardianReport.findMany({
      where: { reporterCollaboratorId: { not: null } },
      select: { type: true, reporterCollaboratorId: true, occurredAt: true, reportedAt: true },
    }),
  ]);

  const reports: ReportForAdherence[] = rawReports.flatMap((r) => {
    const at = r.occurredAt ?? r.reportedAt;
    return at ? [{ type: r.type, reporterCollaboratorId: r.reporterCollaboratorId, at }] : [];
  });
  const lastReportDay = reports.length > 0 ? new Date(Math.max(...reports.map((r) => r.at.getTime()))).toISOString().slice(0, 10) : null;

  const nowMonth = currentMonthKey();
  const months = new Set<string>([nowMonth, month]);
  for (const r of reports) months.add(monthKeyOf(r.at));

  // Congela os meses que fecharam: já passaram e há relato importado de depois do fim deles (importação completa até a virada).
  const snapshots = await loadSnapshots();
  for (const m of months) {
    if (m >= nowMonth || snapshots.has(m) || !lastReportDay || lastReportDay < nextMonthStartDay(m)) continue;
    const detail = buildAdherenceDetail(m, collaborators, reports, null);
    try {
      await db.guardianMonthSnapshot.create({ data: { month: m, data: JSON.parse(JSON.stringify({ ...detail, frozen: true })) } });
      snapshots.set(m, { ...detail, frozen: true });
    } catch (error) {
      console.error("[guardian] não consegui congelar o mês", m, error);
    }
  }

  const detailOf = (m: string): GuardianAdherence => {
    const snap = snapshots.get(m);
    if (!snap) return buildAdherenceDetail(m, collaborators, reports, null);
    // Fechamento de antes da divisão liderança/operação: o geral continua travado; a divisão é calculada agora (e avisada).
    return snap.groups ? snap : { ...snap, groups: buildGroups(m, collaborators, reports), groupsLive: true };
  };

  const history = Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .map((m) => {
      const d = detailOf(m);
      return { month: m, activeCollaboratorsCount: d.activeCollaboratorsCount, reportedCount: d.reportedCount, adherencePercent: d.adherencePercent, reportsCount: d.reportsCount };
    });

  // Filtro por dias: números só do período, sem mexer no fechamento do mês (que continua valendo no histórico e quando o filtro é limpo).
  if (period) {
    const fromAt = new Date(`${period.from}T00:00:00Z`);
    const toAt = new Date(new Date(`${period.to}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000);
    const inPeriod = reports.filter((r) => r.at >= fromAt && r.at < toAt);
    const selectedPeriod = { ...buildAdherenceDetail(month, collaborators, inPeriod, lastReportDay), period };
    return { selected: selectedPeriod, history };
  }

  const selected = { ...detailOf(month), lastReportDay };
  return { selected, history };
}

/**
 * Adesão (%) de um mês contando só os relatos até o dia informado: serve para comparar o mês em andamento com o MESMO PONTO do mês passado, em vez de
 * comparar um mês parcial com um mês inteiro. O denominador é o do mês (quem estava na casa nele). `null` se não há ninguém.
 */
export async function getGuardianPercentUntilDay(user: CurrentUser, month: string, day: number): Promise<number | null> {
  requireGuardianView(user);
  const [y, m] = month.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, day + 1));
  const [collaborators, rawReports] = await Promise.all([
    loadCollaboratorsForAdherence(),
    db.guardianReport.findMany({ where: { reporterCollaboratorId: { not: null } }, select: { type: true, reporterCollaboratorId: true, occurredAt: true, reportedAt: true } }),
  ]);
  const reports: ReportForAdherence[] = rawReports.flatMap((r) => {
    const at = r.occurredAt ?? r.reportedAt;
    return at && at < cutoff ? [{ type: r.type, reporterCollaboratorId: r.reporterCollaboratorId, at }] : [];
  });
  const s = summarizeMonth(month, collaborators, reports);
  return s.inMonth.length > 0 ? Math.round((s.countByCollaborator.size / s.inMonth.length) * 100) : null;
}

/** Reabre um mês congelado (apaga o fechamento): na próxima consulta ele é recalculado e congelado de novo. Usar depois de corrigir/importar relatos que faltavam. */
export async function reopenGuardianMonth(user: CurrentUser, month: string) {
  if (!hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE)) throw new ForbiddenError();
  if (!isValidMonthKey(month)) throw new Error("Mês inválido.");
  await db.guardianMonthSnapshot.deleteMany({ where: { month } });
}

/** Relatos de um mês (pela data da ocorrência), mais recentes primeiro. Mostra só os de quem conta naquele mês — a mesma
 * regra da adesão e do ranking: no mês corrente, quem já foi desligado sai da lista; num mês fechado, quem estava na casa
 * naquele mês continua (o histórico não muda). Relato sem colaborador da LOG20 creditado também não entra. */
export async function listGuardianReportsOfMonth(user: CurrentUser, month: string) {
  requireGuardianView(user);
  const { start, end } = monthRange(month);
  const [reports, collaborators] = await Promise.all([
    db.guardianReport.findMany({
      where: { OR: [{ occurredAt: { gte: start, lt: end } }, { occurredAt: null, reportedAt: { gte: start, lt: end } }] },
      include: { reporterCollaborator: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    loadCollaboratorsForAdherence(),
  ]);
  const isCurrent = month === currentMonthKey();
  const counted = new Map(collaborators.filter((c) => wasActiveDuring(c, start, end, isCurrent)).map((c) => [c.id, c]));
  const visible = reports.filter((r) => r.reporterCollaboratorId !== null && counted.has(r.reporterCollaboratorId));
  const golden = visible.filter((r) => isGoldenRule(r.raw));
  const reviews = await loadGoldenReviews(golden.map((r) => r.guardianId));
  return visible.map(({ raw, ...r }) => {
    const goldenRule = isGoldenRule(raw);
    return {
      ...r,
      isLeader: counted.get(r.reporterCollaboratorId!)?.isLeader ?? false,
      goldenRule,
      goldenReview: goldenRule ? (reviews.get(r.guardianId) ?? null) : null,
      reported: goldenRule ? reportedPerson(raw) : null,
    };
  });
}

export type GoldenRuleReview = { outcome: GoldenRuleOutcome; note: string | null; decidedByName: string; decidedAt: Date };

/** Conclusões já dadas aos relatos de Regra de Ouro. Leitura tolerante: sem a tabela no banco, tudo aparece como pendente. */
async function loadGoldenReviews(guardianIds: string[]): Promise<Map<string, GoldenRuleReview>> {
  const map = new Map<string, GoldenRuleReview>();
  if (guardianIds.length === 0) return map;
  try {
    const rows = await db.guardianGoldenRuleReview.findMany({ where: { guardianId: { in: guardianIds } } });
    for (const r of rows) map.set(r.guardianId, { outcome: r.outcome as GoldenRuleOutcome, note: r.note, decidedByName: r.decidedByName, decidedAt: r.decidedAt });
  } catch (error) {
    console.error("[guardian] conclusões de regra de ouro indisponíveis:", error);
  }
  return map;
}

/** Regras de Ouro ainda sem conclusão em OUTROS meses (pra não ficar esquecida uma de um mês que já virou): quantas por mês. */
export async function listPendingGoldenRulesOutsideMonth(user: CurrentUser, month: string): Promise<{ month: string; count: number }[]> {
  requireGuardianView(user);
  const rows = await db.guardianReport.findMany({
    where: { raw: { contains: "Regra de Ouro" }, reporterCollaboratorId: { not: null } },
    select: { guardianId: true, raw: true, occurredAt: true, reportedAt: true },
  });
  const golden = rows.filter((r) => isGoldenRule(r.raw));
  const reviews = await loadGoldenReviews(golden.map((r) => r.guardianId));
  const byMonth = new Map<string, number>();
  for (const r of golden) {
    const at = r.occurredAt ?? r.reportedAt;
    if (!at || reviews.has(r.guardianId)) continue;
    const m = monthKeyOf(at);
    if (m !== month) byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  return Array.from(byMonth.entries())
    .map(([m, count]) => ({ month: m, count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Conclui (ou reabre, com `outcome` nulo) um relato de Regra de Ouro: MDT aplicado ou desconsiderado. */
export async function resolveGoldenRule(user: CurrentUser, guardianId: string, outcome: GoldenRuleOutcome | null, note: string | null) {
  if (!hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE)) throw new ForbiddenError();
  const report = await db.guardianReport.findUnique({ where: { guardianId }, select: { raw: true } });
  if (!report || !isGoldenRule(report.raw)) throw new Error("Esse relato não é de Regra de Ouro.");
  if (outcome === null) {
    await db.guardianGoldenRuleReview.deleteMany({ where: { guardianId } });
    return;
  }
  const cleanNote = note?.trim() ? note.trim().slice(0, 500) : null;
  await db.guardianGoldenRuleReview.upsert({
    where: { guardianId },
    create: { guardianId, outcome, note: cleanNote, decidedById: user.id, decidedByName: user.name },
    update: { outcome, note: cleanNote, decidedById: user.id, decidedByName: user.name, decidedAt: new Date() },
  });
}

/** Cargos que existem no turno ADM (hoje, entre os ativos) e se cada um é operação (fora da liderança). `configured` falso = ainda é a sugestão automática. */
export async function getLeadershipSettings(user: CurrentUser) {
  requireGuardianView(user);
  const [people, config] = await Promise.all([
    db.collaborator.findMany({ where: { active: true, functionId: { not: null } }, select: { functionId: true, function: { select: { name: true } }, turno: { select: { name: true } } } }),
    loadLeadershipConfig(),
  ]);
  const byFunction = new Map<string, { id: string; name: string; people: number }>();
  for (const p of people) {
    if (!isAdmTurno(p.turno?.name) || !p.functionId) continue;
    const f = byFunction.get(p.functionId) ?? { id: p.functionId, name: p.function?.name ?? "?", people: 0 };
    f.people += 1;
    byFunction.set(p.functionId, f);
  }
  return {
    configured: config.configured,
    functions: Array.from(byFunction.values())
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((f) => ({ ...f, operational: config.configured ? config.ids.has(f.id) : !isGuardianLeader({ turnoName: "ADM", functionId: f.id, functionName: f.name }, null) })),
  };
}

/** Define quais cargos do turno ADM são operação (fora da liderança). Vale para os meses em aberto; mês já fechado só muda se for reaberto. */
export async function saveLeadershipFunctions(user: CurrentUser, functionIds: string[]) {
  if (!hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE)) throw new ForbiddenError();
  const valid = await db.jobFunction.findMany({ where: { id: { in: functionIds } }, select: { id: true } });
  const ids = valid.map((f) => f.id);
  await db.guardianLeadershipConfig.upsert({
    where: { id: "default" },
    create: { id: "default", functionIds: ids },
    update: { functionIds: ids },
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
