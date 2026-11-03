import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { countsAsTurnover, effectiveKind, tenureDays, TERMINATION_KIND_LABEL, type TerminationKind } from "@/domain/termination/rules";
import { lastCountedMonth } from "@/domain/termination/presence";
import { loadPresence } from "@/server/services/turnover-base";
import { interviewDiagnosis, sanitizeRatings, summarizeInterviews, type InterviewSummary } from "@/domain/termination/interview";
import { loadHeadcountBase } from "@/server/services/exit-interview.service";
import { getExitSurvey } from "@/server/services/exit-survey.service";
import { surveyDiagnosis } from "@/domain/termination/survey";
import { buildYearResults, diagnose, exitsBudget, goalStatus, yearMonthInputs, type GoalStatus, type PdcaAction, type PdcaActionStatus, type PdcaCause, type YearMonthResult } from "@/domain/termination/pdca";

const RH = PERMISSIONS.HR_MANAGE;
const MONTH_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type PdcaData = {
  owner: string;
  monthlyGoal: number | null;
  ytdGoal: number | null;
  annualGoal: number | null;
  causes: PdcaCause[];
  actions: PdcaAction[];
  standardization: string;
};

export type PdcaView = {
  ready: boolean;
  year: number;
  data: PdcaData;
  /** Turnover de cada mês fechado do ano (conta do BI): do mês e acumulado. */
  months: (YearMonthResult & { label: string })[];
  /** Último mês contado (o corrente, até hoje): turnover do mês e acumulado do ano. */
  current: { month: string; label: string; rate: number | null; ytdRate: number | null; monthExits: number; monthQlp: number; ytdExits: number; ytdQlp: number } | null;
  status: { monthly: GoalStatus; ytd: GoalStatus; annual: GoalStatus };
  budget: number | null;
  diagnosis: string[];
  firstTermination: Date | null;
  kinds: { label: string; count: number }[];
  interviews: InterviewSummary | null;
  /** Último mês contado do ano (AAAA-MM), ou null se o ano ainda não começou: é o período da cascata do turnover. */
  closedMonthKey: string | null;
  survey: Awaited<ReturnType<typeof getExitSurvey>>;
  /** Efetivo oficial informado (AAAA-MM → pessoas), no lugar da estimativa do cadastro. */
  headcountBase: Record<string, number>;
  /** Como o número foi calculado: o que o RH precisa ver para confiar nele. */
  basis: {
    /** Último mês contado ("Nov/2026") ou null se o ano ainda não começou. */
    closedLabel: string | null;
    /** Período contado ("Jan/2026 a Out/2026"). */
    windowLabel: string | null;
    /** O primeiro desligamento importado é de fevereiro ou depois (ou não há nenhum): saídas de janeiro podem estar faltando. */
    historyStartsLate: boolean;
    unplaced: number;
    source: "oficial" | "cadastro" | "misto";
  };
};

const empty = (): PdcaData => ({ owner: "", monthlyGoal: null, ytdGoal: null, annualGoal: null, causes: [], actions: [], standardization: "" });

function readList<T>(value: unknown, pick: (o: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => (v && typeof v === "object" ? [pick(v as Record<string, unknown>)] : [])).filter((x): x is T => x !== null);
}
const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const STATUSES: PdcaActionStatus[] = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA"];

function toCauses(value: unknown): PdcaCause[] {
  return readList(value, (o) => (str(o.text) ? { id: str(o.id, 60) || randomUUID(), text: str(o.text), evidence: str(o.evidence), parentId: str(o.parentId, 80) || null, root: o.root === true } : null)).slice(0, 200);
}
function toActions(value: unknown): PdcaAction[] {
  return readList(value, (o) =>
    str(o.what)
      ? { id: str(o.id, 60) || randomUUID(), what: str(o.what), why: str(o.why), who: str(o.who, 120), due: /^\d{4}-\d{2}-\d{2}$/.test(str(o.due, 10)) ? str(o.due, 10) : "", status: STATUSES.includes(o.status as PdcaActionStatus) ? (o.status as PdcaActionStatus) : "PENDENTE", note: str(o.note), causeId: str(o.causeId, 60) || null }
      : null,
  ).slice(0, 60);
}

export async function getPdcaView(user: CurrentUser, year: number): Promise<PdcaView> {
  requirePermission(user, RH);
  let rowOf: { owner: string | null; monthlyGoal: number | null; ytdGoal: number | null; annualGoal: number | null; causes: unknown; actions: unknown; standardization: string | null } | null = null;
  let all: Awaited<ReturnType<typeof db.termination.findMany>> = [];
  let ready = true;
  try {
    [all, rowOf] = await Promise.all([db.termination.findMany({ orderBy: { terminationDate: "asc" } }), db.turnoverPdca.findUnique({ where: { year } })]);
  } catch (error) {
    console.error("[pdca] tabelas indisponíveis:", error);
    ready = false;
  }
  const data: PdcaData = rowOf
    ? { owner: rowOf.owner ?? "", monthlyGoal: rowOf.monthlyGoal, ytdGoal: rowOf.ytdGoal, annualGoal: rowOf.annualGoal, causes: toCauses(rowOf.causes), actions: toActions(rowOf.actions), standardization: rowOf.standardization ?? "" }
    : empty();

  const [presence, headcountBase] = await Promise.all([loadPresence(), loadHeadcountBase()]);
  const counted = all.filter((t) => countsAsTurnover(effectiveKind(t.kind, t.reason)));
  const now = new Date();
  // Como no BI: o mês corrente conta até hoje (ele aparece no gráfico do BI mesmo parcial).
  const lastMonthIdx = lastCountedMonth(year, now);
  const firstExit = all[0]?.terminationDate ?? null;

  // Conta do BI: turnover do mês = demissões do mês ÷ QLP do mês; acumulado = demissões do ano ÷ média do QLP dos meses.
  const results = buildYearResults(yearMonthInputs({ year, lastIdx: lastMonthIdx, now, counted, people: presence.people, headcountBase }));
  const months = results.map((r, m) => ({ ...r, label: MONTH_LABEL[m] }));
  const last = results[results.length - 1] ?? null;
  const currentRate = last?.ytdRate ?? null;
  const historyStartsLate = firstExit === null || firstExit >= new Date(year, 1, 1);

  // Diagnóstico sobre as saídas do ano até hoje.
  const windowStart = new Date(year, 0, 1);
  const windowEnd = new Date(year, Math.max(lastMonthIdx, -1) + 1, 1);
  const inWindow = counted.filter((t) => t.terminationDate >= windowStart && t.terminationDate < windowEnd);
  const top = (key: (t: (typeof inWindow)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const t of inWindow) {
      const k = key(t);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    const first = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return first ? { label: first[0], count: first[1] } : null;
  };
  const days = inWindow.map((t) => tenureDays(t.admissionDate, t.terminationDate));
  const known = days.filter((d): d is number => d !== null);
  const kindOf = (t: (typeof inWindow)[number]): TerminationKind => effectiveKind(t.kind, t.reason);
  const byMonth = new Map<string, number>();
  for (const t of inWindow) {
    const k = `${MONTH_LABEL[t.terminationDate.getMonth()]}/${String(t.terminationDate.getFullYear()).slice(2)}`;
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
  }
  const peak = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];
  let interviews: InterviewSummary | null = null;
  const survey = await getExitSurvey();
  if (ready && inWindow.length > 0) {
    try {
      const rows = await db.exitInterview.findMany({ where: { terminationId: { in: inWindow.map((t) => t.id) } } });
      interviews = summarizeInterviews(
        rows.map((r) => ({
          primaryReason: r.primaryReason,
          secondaryReasons: Array.isArray(r.secondaryReasons) ? (r.secondaryReasons as unknown[]).filter((k): k is string => typeof k === "string") : [],
          ratings: sanitizeRatings(r.ratings),
          wouldReturn: r.wouldReturn,
        })),
      );
    } catch (error) {
      console.error("[pdca] entrevistas indisponíveis:", error);
    }
  }
  const diagnosis = ready && inWindow.length > 0
    ? diagnose({
        exits: inWindow.length,
        voluntary: inWindow.filter((t) => kindOf(t) === "VOLUNTARIO").length,
        early90: known.filter((d) => d <= 90).length,
        withTenure: known.length,
        unclassified: inWindow.filter((t) => kindOf(t) === "NAO_CLASSIFICADO").length,
        topArea: top((t) => t.areaName),
        topTurno: top((t) => t.turnoName),
        topCargo: top((t) => t.cargo),
        peakMonth: peak ? { label: peak[0], count: peak[1] } : null,
      }).concat(interviews ? interviewDiagnosis(interviews, inWindow.filter((t) => kindOf(t) === "VOLUNTARIO").length) : [], surveyDiagnosis(survey.motivos?.data ?? null, survey.satisfacao?.data ?? null))
    : [];
  const kinds = new Map<string, number>();
  for (const t of inWindow) kinds.set(TERMINATION_KIND_LABEL[kindOf(t)].split(" (")[0], (kinds.get(TERMINATION_KIND_LABEL[kindOf(t)].split(" (")[0]) ?? 0) + 1);

  return {
    ready,
    year,
    data,
    months,
    current: ready && last && lastMonthIdx >= 0 ? { month: last.month, label: `${MONTH_LABEL[lastMonthIdx]}/${year}`, rate: last.rate, ytdRate: last.ytdRate, monthExits: last.exits, monthQlp: last.qlp, ytdExits: last.ytdExits, ytdQlp: last.ytdQlp } : null,
    status: { monthly: goalStatus(last?.rate ?? null, data.monthlyGoal), ytd: goalStatus(currentRate, data.ytdGoal), annual: goalStatus(currentRate, data.annualGoal) },
    budget: last ? exitsBudget(data.annualGoal, last.ytdQlp, last.ytdExits) : null,
    diagnosis,
    firstTermination: counted[0]?.terminationDate ?? null,
    kinds: [...kinds.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    interviews,
    survey,
    closedMonthKey: lastMonthIdx >= 0 ? `${year}-${String(lastMonthIdx + 1).padStart(2, "0")}` : null,
    headcountBase: Object.fromEntries(headcountBase),
    basis: {
      closedLabel: lastMonthIdx >= 0 ? `${MONTH_LABEL[lastMonthIdx]}/${year}` : null,
      windowLabel: lastMonthIdx >= 0 ? `Jan/${year} a ${MONTH_LABEL[lastMonthIdx]}/${year}` : null,
      historyStartsLate,
      unplaced: presence.unplaced,
      source: results.length === 0 ? ("cadastro" as const) : results.every((r) => r.qlpSource === "oficial") ? ("oficial" as const) : results.some((r) => r.qlpSource === "oficial") ? ("misto" as const) : ("cadastro" as const),
    },
  };
}

const goalOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
};

export async function savePdca(user: CurrentUser, year: number, input: PdcaData) {
  requirePermission(user, RH);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error("Ano inválido.");
  const data = {
    owner: str(input.owner, 120) || null,
    monthlyGoal: goalOf(input.monthlyGoal),
    ytdGoal: goalOf(input.ytdGoal),
    annualGoal: goalOf(input.annualGoal),
    causes: toCauses(input.causes),
    actions: toActions(input.actions),
    standardization: str(input.standardization, 4000) || null,
    updatedById: user.id,
  };
  await db.turnoverPdca.upsert({ where: { year }, update: data, create: { year, ...data } });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "TurnoverPdca", entityId: String(year), newValue: { goals: [data.monthlyGoal, data.ytdGoal, data.annualGoal], causes: data.causes.length, actions: data.actions.length } });
}
