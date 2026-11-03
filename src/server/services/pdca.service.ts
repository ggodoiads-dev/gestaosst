import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { countsAsTurnover, effectiveKind, tenureBucket, tenureDays, TENURE_BUCKET_LABEL, TERMINATION_KIND_LABEL, type TerminationKind } from "@/domain/termination/rules";
import { buildCascade, type CascadeGroup } from "@/domain/termination/cascade";
import { lastClosedMonth, presenceAt, windowIsCovered } from "@/domain/termination/presence";
import { loadPresence } from "@/server/services/turnover-base";
import { interviewDiagnosis, sanitizeRatings, summarizeInterviews, type InterviewSummary } from "@/domain/termination/interview";
import { loadHeadcountBase } from "@/server/services/exit-interview.service";
import { getExitSurvey } from "@/server/services/exit-survey.service";
import { surveyDiagnosis } from "@/domain/termination/survey";
import { averageHeadcount, diagnose, exitsBudget, goalStatus, rollingTurnover, type GoalStatus, type PdcaAction, type PdcaActionStatus, type PdcaCause, type WindowMonth } from "@/domain/termination/pdca";

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
  /** Turnover móvel (12 meses) no fim de cada mês do ano. */
  rolling: { month: string; label: string; exits: number; rate: number | null }[];
  current: { month: string; label: string; rate: number | null; exits12: number; avgHeadcount: number } | null;
  status: { monthly: GoalStatus; ytd: GoalStatus; annual: GoalStatus };
  budget: number | null;
  diagnosis: string[];
  firstTermination: Date | null;
  kinds: { label: string; count: number }[];
  interviews: InterviewSummary | null;
  survey: Awaited<ReturnType<typeof getExitSurvey>>;
  /** Ramos da cascata de causas (Plan), montados dos dados da janela. */
  cascade: CascadeGroup[];
  /** Efetivo oficial informado (AAAA-MM → pessoas), no lugar da estimativa do cadastro. */
  headcountBase: Record<string, number>;
  /** Como o número foi calculado: o que o RH precisa ver para confiar nele. */
  basis: {
    /** Último mês fechado usado ("Out/2026") ou null se o ano ainda não fechou nenhum mês. */
    closedLabel: string | null;
    windowLabel: string | null;
    /** A janela de 12 meses começa depois do primeiro desligamento importado? Senão o histórico está incompleto. */
    covered: boolean;
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
  const people = presence.people;
  const counted = all.filter((t) => countsAsTurnover(effectiveKind(t.kind, t.reason)));
  const now = new Date();
  // O indicador usa só MESES FECHADOS: o mês corrente tem saídas parciais contra um efetivo cheio e puxaria o número para baixo.
  const lastMonthIdx = lastClosedMonth(year, now);
  const firstExit = all[0]?.terminationDate ?? null;

  // Estatística de cada mês de (ano-1) até o último mês do ano, para montar as janelas de 12 meses.
  const stats = new Map<string, WindowMonth>();
  for (let y = year - 1; y <= year; y++) {
    for (let m = 0; m < 12; m++) {
      if (y === year && m > lastMonthIdx) break;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      // Efetivo oficial do mês, quando informado, vale no lugar da estimativa feita pelo cadastro.
      const official = headcountBase.get(`${y}-${String(m + 1).padStart(2, "0")}`);
      stats.set(`${y}-${m}`, {
        exits: counted.filter((t) => t.terminationDate.getFullYear() === y && t.terminationDate.getMonth() === m).length,
        headcountStart: official ?? presenceAt(people, start),
        headcountEnd: official ?? presenceAt(people, end > now ? now : end),
      });
    }
  }
  const windowAt = (m: number): WindowMonth[] => {
    const w: WindowMonth[] = [];
    for (let k = 11; k >= 0; k--) {
      const idx = year * 12 + m - k;
      const s = stats.get(`${Math.floor(idx / 12)}-${idx % 12}`);
      if (s) w.push(s);
    }
    return w;
  };
  const rolling = Array.from({ length: Math.max(lastMonthIdx + 1, 0) }, (_, m) => {
    const w = windowAt(m);
    const covered = windowIsCovered(new Date(year, m - 11, 1), firstExit);
    return { month: `${year}-${String(m + 1).padStart(2, "0")}`, label: MONTH_LABEL[m], exits: w.reduce((s, x) => s + x.exits, 0), rate: covered && w.length === 12 ? rollingTurnover(w) : null };
  });
  const lastWindow = windowAt(lastMonthIdx);
  const exits12 = lastWindow.reduce((s, x) => s + x.exits, 0);
  const avg = averageHeadcount(lastWindow);
  const currentRate = lastMonthIdx >= 0 ? (rolling[lastMonthIdx]?.rate ?? null) : null;
  const covered = lastMonthIdx >= 0 && windowIsCovered(new Date(year, lastMonthIdx - 11, 1), firstExit);

  // Diagnóstico sobre as saídas da janela atual.
  const windowStart = new Date(year, Math.max(lastMonthIdx, 0) - 11, 1);
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

  const countBy = (key: (t: (typeof inWindow)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const t of inWindow) {
      const k = key(t);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  };
  const cascade = ready
    ? buildCascade({
        total: inWindow.length,
        kinds: [...kinds.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
        motives: interviews?.primary ?? [],
        interviewCount: interviews?.count ?? 0,
        ratings: interviews?.ratings ?? [],
        wouldReturnPct: interviews?.wouldReturnPct ?? null,
        tenure: (["ATE_90", "91_180", "181_365", "MAIS_1_ANO"] as const).map((b) => ({ label: TENURE_BUCKET_LABEL[b], count: inWindow.filter((t) => tenureBucket(tenureDays(t.admissionDate, t.terminationDate)) === b).length })),
        areas: countBy((t) => t.areaName),
        turnos: countBy((t) => t.turnoName),
        cargos: countBy((t) => t.cargo),
        survey: { motivos: survey.motivos?.data ?? null, satisfacao: survey.satisfacao?.data ?? null, motivosPeriod: survey.motivos?.periodLabel ?? null, satisfacaoPeriod: survey.satisfacao?.periodLabel ?? null },
      })
    : [];

  return {
    ready,
    year,
    data,
    rolling,
    current: ready && lastMonthIdx >= 0 && covered ? { month: rolling[lastMonthIdx].month, label: `${MONTH_LABEL[lastMonthIdx]}/${year}`, rate: currentRate, exits12, avgHeadcount: Math.round(avg) } : null,
    status: { monthly: goalStatus(currentRate, data.monthlyGoal), ytd: goalStatus(currentRate, data.ytdGoal), annual: goalStatus(currentRate, data.annualGoal) },
    budget: exitsBudget(data.annualGoal, avg, exits12),
    diagnosis,
    firstTermination: counted[0]?.terminationDate ?? null,
    kinds: [...kinds.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    interviews,
    survey,
    cascade,
    headcountBase: Object.fromEntries(headcountBase),
    basis: {
      closedLabel: lastMonthIdx >= 0 ? `${MONTH_LABEL[lastMonthIdx]}/${year}` : null,
      windowLabel: lastMonthIdx >= 0 ? `${MONTH_LABEL[((lastMonthIdx - 11) % 12 + 12) % 12]}/${new Date(year, lastMonthIdx - 11, 1).getFullYear()} a ${MONTH_LABEL[lastMonthIdx]}/${year}` : null,
      covered,
      unplaced: presence.unplaced,
      source: (() => {
        const months = [...stats.keys()].length;
        const official = [...stats.keys()].filter((k) => {
          const [yy, mm] = k.split("-").map(Number);
          return headcountBase.has(`${yy}-${String(mm + 1).padStart(2, "0")}`);
        }).length;
        return official === 0 ? ("cadastro" as const) : official >= months ? ("oficial" as const) : ("misto" as const);
      })(),
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
