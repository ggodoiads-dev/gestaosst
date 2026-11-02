import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getGuardianAdherence } from "@/server/services/guardian.service";
import { listDtoOfMonth } from "@/server/services/dto.service";
import { compliancePercent, getChecklistComplianceDashboard } from "@/server/services/checklist-compliance.service";
import { getProductionView } from "@/server/services/production.service";
import { getTmaView } from "@/server/services/tma.service";
import { getProductivityDashboard } from "@/server/services/productivity.service";
import { TMA_TARGET_MIN, formatDuration } from "@/domain/tma/stats";
import { isWarehouseHelper } from "@/domain/production/helpers";
import {
  accidentFindings,
  checklistFindings,
  deltaText,
  dtoFindings,
  guardianFindings,
  kpi,
  nonconformityFindings,
  productionFindings,
  sortFindings,
  tmaFindings,
  trendTone,
} from "@/domain/reports/analysis";
import type { Finding, Kpi, MonthlyReport, ReportSection, ReportVersion } from "@/domain/reports/types";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const monthLabelOf = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} de ${key.slice(0, 4)}`;
export const shortLabel = (key: string) => `${SHORT[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
export function shiftMonth(key: string, delta: number): string {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const range = (key: string) => ({ start: new Date(`${key}-01T00:00:00Z`), end: new Date(`${shiftMonth(key, 1)}-01T00:00:00Z`) });
export const lastMonths = (key: string, n: number) => Array.from({ length: n }, (_, i) => shiftMonth(key, i - (n - 1)));
export const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
export const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));

type Built = { section: ReportSection; findings: Finding[]; exec: Kpi[] };
type Ctx = { user: CurrentUser; month: string; prev: string; internal: boolean; nowKey: string };

/** Executa um módulo; sem permissão ou com falha, o módulo sai do relatório (e é listado como indisponível) em vez de derrubar tudo. */
async function safe(name: string, unavailable: string[], fn: () => Promise<Built | null>): Promise<Built | null> {
  try {
    const built = await fn();
    if (!built) unavailable.push(name);
    return built;
  } catch (error) {
    if (!(error instanceof ForbiddenError)) console.error(`[relatorio] módulo ${name} falhou:`, error);
    unavailable.push(name);
    return null;
  }
}

// ------------------------------------------------------------------------------------------------ Acidentes
async function accidentsSection(c: Ctx): Promise<Built | null> {
  if (!hasPermission(c.user, PERMISSIONS.ACCIDENT_MANAGE)) return null;
  const months = lastMonths(c.month, 6);
  const from = range(months[0]).start;
  const { end } = range(c.month);
  const rows = await db.accident.findMany({
    where: { date: { gte: from, lt: end }, status: { not: "CANCELADA" } },
    select: { code: true, date: true, type: true, severity: true, isSif: true, sifClassification: true, description: true, area: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  const keyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, typeof rows>();
  for (const r of rows) byMonth.set(keyOf(r.date), [...(byMonth.get(keyOf(r.date)) ?? []), r]);
  const cur = byMonth.get(c.month) ?? [];
  const prevRows = byMonth.get(c.prev) ?? [];
  const injuryTypes = ["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "FAI", "DOENCA_OCUPACIONAL"];
  const withInjury = cur.filter((r) => injuryTypes.includes(r.type)).length;
  const prevInjury = prevRows.filter((r) => injuryTypes.includes(r.type)).length;
  const sif = cur.filter((r) => r.isSif).length;
  const prevSif = prevRows.filter((r) => r.isSif).length;
  const sifReal = cur.filter((r) => r.sifClassification === "SIF_REAL").length;
  const typeLabel: Record<string, string> = { ACIDENTE_TIPICO: "Acidente típico", ACIDENTE_TRAJETO: "Acidente de trajeto", QUASE_ACIDENTE: "Quase acidente", DOENCA_OCUPACIONAL: "Doença ocupacional", FAI: "FAI (1º atendimento)" };
  const byType = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const r of cur) {
    byType.set(typeLabel[r.type] ?? r.type, (byType.get(typeLabel[r.type] ?? r.type) ?? 0) + 1);
    byArea.set(r.area?.name ?? "Sem área", (byArea.get(r.area?.name ?? "Sem área") ?? 0) + 1);
  }
  const findings = accidentFindings({ total: cur.length, prevTotal: prevRows.length, withInjury, sif, sifReal, latestCodes: cur.filter((r) => r.isSif).map((r) => r.code) });
  const section: ReportSection = {
    key: "acidentes",
    title: "Acidentes, incidentes e SIF",
    scope: "Ocorrências da LOG20 registradas no SIGO (importadas do Credit ou lançadas), sem as canceladas.",
    kpis: [
      kpi("acc-total", "Ocorrências no mês", String(cur.length), trendTone(cur.length, prevRows.length, false), deltaText(cur.length, prevRows.length, "abs")),
      kpi("acc-injury", "Com lesão", String(withInjury), withInjury > 0 ? "bad" : "good", deltaText(withInjury, prevInjury, "abs")),
      kpi("acc-sif", "Com potencial SIF", String(sif), sif > 0 ? "bad" : "good", deltaText(sif, prevSif, "abs"), sifReal > 0 ? `${sifReal} SIF real` : undefined),
    ],
    series: [{ title: "Ocorrências por mês (últimos 6 meses)", points: months.map((m) => ({ label: shortLabel(m), value: (byMonth.get(m) ?? []).length })), highlightLast: true }],
    tables: [
      { title: "Por tipo", columns: ["Tipo", "Qtde"], rows: [...byType.entries()].sort((a, b) => b[1] - a[1]), rightAlign: [1] },
      { title: "Por área", columns: ["Área", "Qtde"], rows: [...byArea.entries()].sort((a, b) => b[1] - a[1]), rightAlign: [1] },
      {
        title: "Ocorrências do mês",
        columns: ["Código", "Data", "Tipo", "Área", "Descrição"],
        rows: cur.slice(0, 15).map((r) => [r.code, r.date.toISOString().slice(8, 10) + "/" + r.date.toISOString().slice(5, 7), typeLabel[r.type] ?? r.type, r.area?.name ?? "—", r.description.length > 140 ? `${r.description.slice(0, 137)}…` : r.description]),
        internalOnly: true,
      },
    ],
    notes: [],
  };
  return { section, findings, exec: [section.kpis[0], section.kpis[2]] };
}

// ------------------------------------------------------------------------------------------------ Guardian
async function guardianSection(c: Ctx): Promise<Built | null> {
  if (!hasPermission(c.user, PERMISSIONS.GUARDIAN_MANAGE) && !hasPermission(c.user, PERMISSIONS.GUARDIAN_VIEW)) return null;
  const { selected, history } = await getGuardianAdherence(c.user, c.month);
  const prev = history.find((h) => h.month === c.prev) ?? null;
  const byTurno = new Map<string, number>();
  for (const p of selected.notReported) byTurno.set(p.turnoName ?? "Sem turno", (byTurno.get(p.turnoName ?? "Sem turno") ?? 0) + 1);
  const worst = [...byTurno.entries()].sort((a, b) => b[1] - a[1])[0];
  const findings = guardianFindings({
    adherence: selected.adherencePercent,
    prevAdherence: prev ? prev.adherencePercent : null,
    notReported: selected.notReportedCount,
    scheduled: selected.activeCollaboratorsCount,
    worstTurno: worst ? { name: worst[0], count: worst[1] } : null,
    internal: c.internal,
  });
  const typeLabel: Record<string, string> = { COMPORTAMENTO_RISCO: "Comportamento de risco", CONDICAO_INSEGURA: "Condição insegura", INCIDENTE: "Incidente", RECONHECIMENTO: "Reconhecimento" };
  const section: ReportSection = {
    key: "guardian",
    title: "Guardian — adesão e relatos de segurança",
    scope: `Dos colaboradores que estavam na casa no mês, quantos relataram ao menos uma vez.${selected.frozen ? " Mês fechado: valores travados." : " Mês em andamento: recomeça do zero a cada mês."}`,
    kpis: [
      kpi("gd-adh", "Adesão", pct(selected.adherencePercent), selected.adherencePercent >= 90 ? "good" : selected.adherencePercent >= 70 ? "warn" : "bad", deltaText(selected.adherencePercent, prev?.adherencePercent, "pts")),
      kpi("gd-rep", "Relataram", `${selected.reportedCount} de ${selected.activeCollaboratorsCount}`, "neutral"),
      kpi("gd-rel", "Relatos no mês", String(selected.reportsCount), trendTone(selected.reportsCount, prev?.reportsCount, true), deltaText(selected.reportsCount, prev?.reportsCount, "pct")),
    ],
    series: [{ title: "Adesão por mês (%)", unit: "%", points: history.filter((h) => h.month <= c.month).slice(0, 6).reverse().map((h) => ({ label: shortLabel(h.month), value: h.adherencePercent })), highlightLast: true }],
    tables: [
      { title: "Relatos por tipo", columns: ["Tipo", "Qtde"], rows: selected.byType.map((t) => [typeLabel[t.type] ?? t.type, t.count]), rightAlign: [1] },
      { title: "Quem ainda não relatou, por turno", columns: ["Turno", "Pessoas"], rows: [...byTurno.entries()].sort((a, b) => b[1] - a[1]), rightAlign: [1] },
      { title: "Quem mais relatou", columns: ["Colaborador", "Relatos"], rows: selected.ranking.slice(0, 8).map((r) => [r.name, r.count]), rightAlign: [1], internalOnly: true },
    ],
    notes: selected.lastReportDay ? [`Relatos importados até ${selected.lastReportDay.split("-").reverse().join("/")}.`] : [],
  };
  return { section, findings, exec: [section.kpis[0]] };
}

// ------------------------------------------------------------------------------------------------ DTO
async function dtoSection(c: Ctx): Promise<Built | null> {
  if (!hasPermission(c.user, PERMISSIONS.DTO_MANAGE) && !hasPermission(c.user, PERMISSIONS.DTO_VIEW)) return null;
  const [cur, prev] = await Promise.all([listDtoOfMonth(c.user, c.month), listDtoOfMonth(c.user, c.prev)]);
  const avg = (list: typeof cur) => {
    const v = list.map((d) => d.scorePercent).filter((n): n is number => n !== null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const avgScore = avg(cur);
  const prevAvg = avg(prev);
  const below60 = cur.filter((d) => d.scorePercent !== null && d.scorePercent < 60).length;
  const byActivity = new Map<string, number[]>();
  for (const d of cur) if (d.scorePercent !== null) byActivity.set(d.activity, [...(byActivity.get(d.activity) ?? []), d.scorePercent]);
  const activityRows = [...byActivity.entries()].map(([a, v]) => [a, v.length, Math.round(v.reduce((x, y) => x + y, 0) / v.length)] as (string | number)[]).sort((a, b) => Number(a[2]) - Number(b[2]));
  const findings = dtoFindings({ count: cur.length, avgScore, prevAvg, below60 });
  const section: ReportSection = {
    key: "dto",
    title: "DTO — observação de comportamento em campo",
    scope: "Avaliações de DTO importadas no mês: nota é a parcela de itens 'sim' entre os avaliados.",
    kpis: [
      kpi("dto-count", "Avaliações no mês", String(cur.length), "neutral", deltaText(cur.length, prev.length, "abs")),
      kpi("dto-avg", "Nota média", avgScore === null ? "—" : pct(avgScore), avgScore === null ? "neutral" : avgScore >= 90 ? "good" : avgScore >= 80 ? "warn" : "bad", deltaText(avgScore, prevAvg, "pts")),
      kpi("dto-low", "Notas abaixo de 60%", String(below60), below60 > 0 ? "bad" : "good"),
    ],
    series: [],
    tables: [
      { title: "Atividades com pior nota", columns: ["Atividade", "Avaliações", "Nota média (%)"], rows: activityRows.slice(0, 6), rightAlign: [1, 2] },
      {
        title: "Menores notas do mês",
        columns: ["Colaborador", "Data", "Atividade", "Nota (%)"],
        rows: cur.filter((d) => d.scorePercent !== null).sort((a, b) => a.scorePercent! - b.scorePercent!).slice(0, 6).map((d) => [d.collaboratorName, d.date.toISOString().slice(8, 10) + "/" + d.date.toISOString().slice(5, 7), d.activity, Math.round(d.scorePercent!)]),
        rightAlign: [3],
        internalOnly: true,
      },
    ],
    notes: cur.length === 0 ? ["Nenhuma avaliação de DTO importada neste mês."] : [],
  };
  return { section, findings, exec: avgScore === null ? [] : [section.kpis[1]] };
}

// ------------------------------------------------------------------------------------------------ Checklists
async function checklistSection(c: Ctx): Promise<Built | null> {
  if (!hasPermission(c.user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) return null;
  const isCurrent = c.month === c.nowKey;
  const [cur, prev] = await Promise.all([
    getChecklistComplianceDashboard(c.user, { month: c.month }),
    getChecklistComplianceDashboard(c.user, { month: c.prev }),
  ]);
  const p = compliancePercent(cur.month);
  const pp = compliancePercent(prev.month);
  const pending = cur.month.shiftsRequired - cur.month.shiftsComplete;
  const findings = checklistFindings({ percent: p, prevPercent: pp, pendingShifts: pending, isCurrentMonth: isCurrent });
  const worst = [...cur.month.people].filter((x) => x.shiftsRequired > x.shiftsComplete).sort((a, b) => b.shiftsRequired - b.shiftsComplete - (a.shiftsRequired - a.shiftsComplete)).slice(0, 8);
  const section: ReportSection = {
    key: "checklists",
    title: "Checklists — aderência por colaborador",
    scope: `Turnos em que alguém era cobrado por checklist e quantos foram cumpridos${isCurrent ? " (mês em andamento, até ontem)" : ""}. Usa a lista de colaboradores e as exigências de hoje.`,
    kpis: [
      kpi("ck-adh", "Aderência", p === null ? "—" : pct(p), p === null ? "neutral" : p >= 95 ? "good" : p >= 85 ? "warn" : "bad", deltaText(p, pp, "pts")),
      kpi("ck-done", "Turnos cumpridos", `${cur.month.shiftsComplete} de ${cur.month.shiftsRequired}`, "neutral"),
      kpi("ck-pend", "Turnos pendentes", String(pending), pending > 0 ? "warn" : "good"),
    ],
    series: [],
    tables: [
      {
        title: "Quem mais deixou de cumprir",
        columns: ["Colaborador", "Área", "Cobrados", "Cumpridos", "Pendentes"],
        rows: worst.map((x) => [x.name, x.areaName ?? "—", x.shiftsRequired, x.shiftsComplete, x.shiftsRequired - x.shiftsComplete]),
        rightAlign: [2, 3, 4],
        internalOnly: true,
      },
    ],
    notes: [],
  };
  return { section, findings, exec: [section.kpis[0]] };
}

// ------------------------------------------------------------------------------------------------ NCs, ações e equipamentos
async function nonconformitySection(c: Ctx): Promise<Built | null> {
  if (!hasPermission(c.user, PERMISSIONS.NONCONFORMITY_VIEW) && !hasPermission(c.user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) return null;
  const now = new Date();
  const { start, end } = range(c.month);
  const prevRange = range(c.prev);
  const closedStatuses = ["CONCLUIDA", "ENCERRADA", "CANCELADA"] as const;
  const [open, openedInMonth, openedPrev, overdueActions, equipmentByStatus, blocked] = await Promise.all([
    db.nonconformity.findMany({
      where: { status: { notIn: [...closedStatuses] } },
      select: { code: true, severity: true, status: true, identifiedAt: true, dueDate: true, responsibleId: true, equipment: { select: { code: true } }, area: { select: { name: true } } },
    }),
    db.nonconformity.count({ where: { identifiedAt: { gte: start, lt: end } } }),
    db.nonconformity.count({ where: { identifiedAt: { gte: prevRange.start, lt: prevRange.end } } }),
    db.actionItem.count({ where: { dueDate: { lt: now }, status: { in: ["PENDENTE", "EM_ANDAMENTO", "VENCIDA"] } } }),
    db.equipment.groupBy({ by: ["status"], where: { active: true }, _count: true }),
    db.equipment.findMany({ where: { active: true, status: "BLOQUEADO" }, select: { code: true, name: true, area: { select: { name: true } } }, take: 10 }),
  ]);
  const critical = open.filter((n) => n.severity === "CRITICA");
  const oldestCritical = critical.length ? Math.max(...critical.map((n) => daysBetween(n.identifiedAt, now))) : null;
  const over30 = open.filter((n) => daysBetween(n.identifiedAt, now) > 30).length;
  const withoutResponsible = open.filter((n) => !n.responsibleId).length;
  const blockedCount = equipmentByStatus.find((e) => e.status === "BLOQUEADO")?._count ?? 0;
  const bySeverity = new Map<string, number>();
  const byEquipment = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const n of open) {
    bySeverity.set(n.severity, (bySeverity.get(n.severity) ?? 0) + 1);
    byEquipment.set(n.equipment.code, (byEquipment.get(n.equipment.code) ?? 0) + 1);
    byArea.set(n.area.name, (byArea.get(n.area.name) ?? 0) + 1);
  }
  const sevLabel: Record<string, string> = { CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
  const findings = nonconformityFindings({ openCritical: critical.length, oldestCriticalDays: oldestCritical, openOver30: over30, openTotal: open.length, withoutResponsible, overdueActions, blockedEquipments: blockedCount });
  const repeated = [...byEquipment.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const section: ReportSection = {
    key: "ncs",
    title: "Não conformidades, ações e equipamentos",
    scope: "Posição HOJE das NCs abertas e das ações vencidas (não é uma foto do fim do mês), e as NCs novas do mês.",
    kpis: [
      kpi("nc-open", "NCs abertas hoje", String(open.length), open.length === 0 ? "good" : "warn"),
      kpi("nc-crit", "NCs críticas abertas", String(critical.length), critical.length > 0 ? "bad" : "good", oldestCritical !== null ? `a mais antiga: ${oldestCritical} dias` : undefined),
      kpi("nc-new", "NCs novas no mês", String(openedInMonth), trendTone(openedInMonth, openedPrev, false), deltaText(openedInMonth, openedPrev, "abs")),
      kpi("nc-act", "Ações vencidas", String(overdueActions), overdueActions > 0 ? "bad" : "good"),
      kpi("nc-blk", "Equipamentos bloqueados", String(blockedCount), blockedCount > 0 ? "bad" : "good"),
    ],
    series: [],
    tables: [
      { title: "NCs abertas por severidade", columns: ["Severidade", "Qtde"], rows: ["CRITICA", "ALTA", "MEDIA", "BAIXA"].filter((s) => bySeverity.has(s)).map((s) => [sevLabel[s], bySeverity.get(s)!]), rightAlign: [1] },
      { title: "NCs abertas por área", columns: ["Área", "Qtde"], rows: [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6), rightAlign: [1] },
      { title: "Equipamentos com mais de uma NC aberta (possível repetição do mesmo defeito)", columns: ["Equipamento", "NCs abertas"], rows: repeated.slice(0, 6), rightAlign: [1], internalOnly: true, note: "O sistema cria uma NC nova a cada checklist reprovado; vale conferir se são defeitos diferentes ou o mesmo defeito repetido." },
      { title: "Equipamentos bloqueados", columns: ["Código", "Nome", "Área"], rows: blocked.map((b) => [b.code, b.name, b.area?.name ?? "—"]), internalOnly: true },
    ],
    notes: [],
  };
  return { section, findings, exec: [section.kpis[1]] };
}

// ------------------------------------------------------------------------------------------------ Produção
async function productionSection(c: Ctx): Promise<Built | null> {
  const [view, prevView] = await Promise.all([getProductionView(c.user, c.month), getProductionView(c.user, c.prev)]);
  if (!view.ready || view.month.reports === 0) return null;
  const m = view.month;
  const pm = prevView.month;
  const t = m.totals;
  const daysInPeriod = c.month === c.nowKey ? new Date().getUTCDate() : new Date(Date.UTC(Number(c.month.slice(0, 4)), Number(c.month.slice(5, 7)), 0)).getUTCDate();
  const findings = productionFindings({ loadedPerDay: m.avgLoadedPerDay, prevLoadedPerDay: pm.avgLoadedPerDay, daysWithReport: m.daysWithReport, daysInPeriod });
  const months = lastMonths(c.month, 6);
  const trend: { label: string; value: number }[] = [];
  try {
    const rows = await db.shiftProduction.findMany({ where: { date: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { date: true, values: true } });
    const sum = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const v = (r.values as Record<string, number> | null)?.carrosCarregados ?? 0;
      sum.set(k, (sum.get(k) ?? 0) + v);
    }
    for (const k of months) trend.push({ label: shortLabel(k), value: sum.get(k) ?? 0 });
  } catch {
    /* sem a série: o resto do módulo segue */
  }
  const section: ReportSection = {
    key: "producao",
    title: "Operação — produção por turno",
    scope: "Relatórios de fim de turno lançados pelos líderes. Carregados sem amarração digitada: todo carro carregado é amarrado.",
    kpis: [
      kpi("pr-load", "Carros carregados", num(t.carrosCarregados), trendTone(m.avgLoadedPerDay, pm.avgLoadedPerDay, true), deltaText(m.avgLoadedPerDay, pm.avgLoadedPerDay, "pct")?.replace("mês anterior", "mês anterior (por dia)")),
      kpi("pr-day", "Média por dia", num(m.avgLoadedPerDay), "neutral", `${m.daysWithReport} dia(s) com relatório`),
      kpi("pr-rate", "Carregados ÷ trabalhados", m.loadedRate === null ? "—" : pct(m.loadedRate), "neutral"),
    ],
    series: trend.length ? [{ title: "Carros carregados por mês (soma dos relatórios)", points: trend, highlightLast: true }] : [],
    tables: [
      {
        title: "Comparativo entre turnos",
        columns: ["Turno", "Relatórios", "Trabalhados", "Carregados", "Média/relatório"],
        rows: m.byTurno.map((tu) => [`Turno ${tu.turno}`, tu.reports, tu.totals.carrosTrabalhados ?? 0, tu.totals.carrosCarregados ?? 0, tu.reports > 0 ? Math.round(((tu.totals.carrosCarregados ?? 0) / tu.reports) * 10) / 10 : 0]),
        rightAlign: [1, 2, 3, 4],
        internalOnly: true,
      },
    ],
    notes: [],
  };
  return { section, findings, exec: [section.kpis[0]] };
}

// ------------------------------------------------------------------------------------------------ TMA
async function tmaSection(c: Ctx): Promise<Built | null> {
  const [view, prevView] = await Promise.all([getTmaView(c.user, c.month), getTmaView(c.user, c.prev)]);
  if (!view.ready || view.selected !== c.month || !view.month) return null;
  const m = view.month;
  const pm = prevView.ready && prevView.selected === c.prev ? prevView.month : null;
  const findings = tmaFindings({ avgMin: m.avgTma, prevAvgMin: pm?.avgTma ?? null, within3h: m.within3h, targetMin: TMA_TARGET_MIN });
  const stageRows: (string | number)[][] = [
    ["Pátio (antes de entrar)", formatDuration(m.stages.patio)],
    ["Espera no armazém", formatDuration(m.stages.espera)],
    ["Carregamento (TMC)", formatDuration(m.stages.carregamento)],
    ["Amarração", formatDuration(m.stages.amarracao)],
    ["Liberação", formatDuration(m.stages.liberacao)],
  ];
  const section: ReportSection = {
    key: "tma",
    title: "Operação — TMA, carregamento e amarração",
    scope: "Planilha de controle de atendimento. TMA = coluna da Ambev dos carros liberados com agendamento; carregado = liberado no mês; amarrado = tem o fim da amarração.",
    kpis: [
      kpi("tma-avg", "TMA", formatDuration(m.avgTma), m.avgTma === null ? "neutral" : m.avgTma <= TMA_TARGET_MIN ? "good" : "bad", deltaText(m.avgTma, pm?.avgTma, "pct"), `meta ${formatDuration(TMA_TARGET_MIN)}`),
      kpi("tma-3h", "Carros em até 3 h", m.within3h === null ? "—" : pct(m.within3h), m.within3h === null ? "neutral" : m.within3h >= 70 ? "good" : m.within3h >= 50 ? "warn" : "bad", deltaText(m.within3h, pm?.within3h, "pts")),
      kpi("tma-load", "Carros carregados", String(m.carregados.total), "neutral", deltaText(m.carregados.total, pm?.carregados.total, "pct"), `${m.carregados.withSchedule} com agendamento`),
      kpi("tma-tied", "Carros amarrados", String(m.amarrados.total), "neutral", undefined, `tempo médio ${formatDuration(m.amarrados.avgAmarracao)}`),
    ],
    series: [],
    tables: [
      { title: "Onde o tempo é gasto (média por etapa)", columns: ["Etapa", "Tempo"], rows: stageRows, rightAlign: [1] },
      {
        title: "Por turno",
        columns: ["Turno", "Carros", "TMA", "Em até 3 h (%)", "Amarração"],
        rows: m.byTurno.slice(0, 6).map((g) => [g.name, g.count, formatDuration(g.avgTma), g.within3h === null ? "—" : Math.round(g.within3h), formatDuration(g.avgAmarracao)]),
        rightAlign: [1, 2, 3, 4],
      },
      {
        title: "Por transportadora (maiores volumes)",
        columns: ["Transportadora", "Carros", "TMA", "Em até 3 h (%)"],
        rows: m.byTransportadora.slice(0, 6).map((g) => [g.name, g.count, formatDuration(g.avgTma), g.within3h === null ? "—" : Math.round(g.within3h)]),
        rightAlign: [1, 2, 3],
      },
    ],
    notes: [],
  };
  return { section, findings, exec: [section.kpis[0]] };
}

// ------------------------------------------------------------------------------------------------ Produtividade (só interno)
async function productivitySection(c: Ctx): Promise<Built | null> {
  const date = c.month === c.nowKey ? new Date() : new Date(Number(c.month.slice(0, 4)), Number(c.month.slice(5, 7)) - 1, 15);
  const { month } = await getProductivityDashboard(c.user, { date });
  if (month.collaboratorsScheduled === 0) return null;
  const adherence = Math.round((month.collaboratorsLogged / month.collaboratorsScheduled) * 100);
  const idle = month.byCollaborator.filter((x) => !x.covered);
  const findings: Finding[] = idle.length > 0
    ? [{ severity: "ATENCAO", module: "Produtividade", title: `${idle.length} ajudante(s) sem o lançamento esperado`, detail: "Escalados no mês, sem produção lançada na atividade da área deles.", recommendation: "Usar 'Lançar o dia da equipe' para regularizar e confirmar se a atividade da área está definida.", internalOnly: true }]
    : [];
  const section: ReportSection = {
    key: "produtividade",
    title: "Operação — produtividade dos ajudantes",
    scope: "Lançamentos por pessoa dos ajudantes de armazém e reformadores, por atividade.",
    kpis: [
      kpi("pd-adh", "Ajudantes com lançamento", `${month.collaboratorsLogged} de ${month.collaboratorsScheduled}`, adherence >= 90 ? "good" : adherence >= 70 ? "warn" : "bad", undefined, `${adherence}% dos escalados`),
      kpi("pd-ent", "Lançamentos", String(month.totalEntries), "neutral"),
    ],
    series: [],
    tables: [
      { title: "Produção por atividade", columns: ["Atividade", "Lançamentos", "Quantidade"], rows: month.byActivity.slice(0, 8).map((a) => [a.activityName.replace(/\s*\(.*$/, ""), a.count, a.totalQuantity > 0 ? a.totalQuantity.toLocaleString("pt-BR") : "—"]), rightAlign: [1, 2], internalOnly: true },
      { title: "Sem o lançamento esperado", columns: ["Ajudante", "Área"], rows: idle.slice(0, 10).map((x) => [x.name, x.areaName ?? "—"]), internalOnly: true },
    ],
    notes: [],
  };
  void isWarehouseHelper;
  return { section, findings, exec: [] };
}

// ------------------------------------------------------------------------------------------------ montagem
const reportCache = new Map<string, { at: number; report: MonthlyReport }>();

export async function buildMonthlyReport(user: CurrentUser, month: string, version: ReportVersion): Promise<MonthlyReport> {
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) throw new ForbiddenError();
  const cacheKey = `${user.id}|${month}|${version}`;
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 120000) return cached.report;

  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const ctx: Ctx = { user, month, prev: shiftMonth(month, -1), internal: version === "interno", nowKey };
  const unavailable: string[] = [];

  // Em sequência (não em paralelo): vários módulos usam as mesmas tabelas pesadas e o relatório não tem pressa.
  const built: Built[] = [];
  const order: [string, (c: Ctx) => Promise<Built | null>, boolean][] = [
    ["Acidentes", accidentsSection, false],
    ["Guardian", guardianSection, false],
    ["DTO", dtoSection, false],
    ["Checklists", checklistSection, false],
    ["Não conformidades e equipamentos", nonconformitySection, false],
    ["Produção por turno", productionSection, false],
    ["TMA", tmaSection, false],
    ["Produtividade dos ajudantes", productivitySection, true],
  ];
  for (const [name, fn, internalOnly] of order) {
    if (internalOnly && version !== "interno") continue;
    const b = await safe(name, unavailable, () => fn(ctx));
    if (b) built.push(b);
  }

  const internal = version === "interno";
  const sections = built.map((b) => ({
    ...b.section,
    tables: b.section.tables.filter((t) => internal || !t.internalOnly),
  }));
  // Versão do cliente: produção interna (por turno) não entra; só o que é de segurança, conformidade e do próprio TMA.
  const visibleSections = internal ? sections : sections.filter((s) => s.key !== "producao");
  const findings = sortFindings(built.flatMap((b) => b.findings).filter((f) => internal || (!f.internalOnly && f.module !== "Produção" && f.module !== "Produtividade")));
  const executive = built.flatMap((b) => b.exec).filter((k) => internal || !k.key.startsWith("pr-"));

  const report: MonthlyReport = {
    month,
    monthLabel: monthLabelOf(month),
    version,
    generatedAt: new Date().toISOString(),
    generatedBy: user.name,
    executive,
    findings,
    sections: visibleSections,
    unavailable,
  };
  reportCache.set(cacheKey, { at: Date.now(), report });
  return report;
}
