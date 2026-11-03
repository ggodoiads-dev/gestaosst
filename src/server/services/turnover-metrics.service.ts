import "server-only";
import { db } from "@/server/db";
import { countsAsTurnover, effectiveKind, tenureDays } from "@/domain/termination/rules";
import { presenceAt, windowIsCovered } from "@/domain/termination/presence";
import { rollingTurnover, type WindowMonth } from "@/domain/termination/pdca";
import { sanitizeRatings } from "@/domain/termination/interview";
import { surveyKey, turnoverMetric, windowEndFor, type TurnoverContext, type WindowExit } from "@/domain/termination/turnover-metrics";
import { loadPresence } from "@/server/services/turnover-base";
import { loadHeadcountBase } from "@/server/services/exit-interview.service";
import { getExitSurvey } from "@/server/services/exit-survey.service";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";

/** O cascateamento pede dezenas de chaves de uma vez para o mesmo mês: o contexto da janela é montado uma vez e reaproveitado por alguns segundos. */
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: Promise<TurnoverContext | null> }>();

async function buildContext(windowEnd: string): Promise<TurnoverContext | null> {
  const [endYear, endMonth] = windowEnd.split("-").map(Number);
  const endIdx = endMonth - 1;
  const windowStart = new Date(endYear, endIdx - 11, 1);
  const windowEndDate = new Date(endYear, endIdx + 1, 1);
  const now = new Date();

  const [presence, headcountBase, all] = await Promise.all([loadPresence(), loadHeadcountBase(), db.termination.findMany({ orderBy: { terminationDate: "asc" } })]);
  const counted = all.filter((t) => countsAsTurnover(effectiveKind(t.kind, t.reason)));

  const window: WindowMonth[] = [];
  for (let k = 11; k >= 0; k--) {
    const date = new Date(endYear, endIdx - k, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);
    const official = headcountBase.get(`${y}-${String(m + 1).padStart(2, "0")}`);
    window.push({
      exits: counted.filter((t) => t.terminationDate.getFullYear() === y && t.terminationDate.getMonth() === m).length,
      headcountStart: official ?? presenceAt(presence.people, start),
      headcountEnd: official ?? presenceAt(presence.people, end > now ? now : end),
    });
  }
  const covered = windowIsCovered(windowStart, presence.firstExit);
  const rate = covered ? rollingTurnover(window) : null;

  const inWindow = counted.filter((t) => t.terminationDate >= windowStart && t.terminationDate < windowEndDate);
  const interviewByTermination = new Map<string, { primaryReason: string; ratings: ReturnType<typeof sanitizeRatings>; wouldReturn: string | null }>();
  if (inWindow.length > 0) {
    try {
      const rows = await db.exitInterview.findMany({ where: { terminationId: { in: inWindow.map((t) => t.id) } } });
      for (const r of rows) interviewByTermination.set(r.terminationId, { primaryReason: r.primaryReason, ratings: sanitizeRatings(r.ratings), wouldReturn: r.wouldReturn });
    } catch (error) {
      console.error("[turnover-metrics] entrevistas indisponíveis:", error);
    }
  }
  const exits: WindowExit[] = inWindow.map((t) => ({
    kind: effectiveKind(t.kind, t.reason),
    tenureDays: tenureDays(t.admissionDate, t.terminationDate),
    turno: t.turnoName,
    area: t.areaName,
    cargo: t.cargo,
    interview: interviewByTermination.get(t.id) ?? null,
  }));

  const survey = await getExitSurvey();
  const byCategory = new Map<string, { satisfacao: number | null; criticos: number | null }>();
  for (const row of survey.satisfacao?.data.rows ?? []) byCategory.set(surveyKey(row.categoria), { satisfacao: row.satisfacao, criticos: row.criticos });
  return { rate, exits, satisfaction: { byCategory, total: survey.satisfacao?.data.total ?? null } };
}

/** Valor de uma chave `turnover.*` para o mês pedido (a janela de 12 meses fechados termina nele; no mês corrente, no último fechado). */
export async function resolveTurnoverMetric(key: string, periodKey: string): Promise<number | null> {
  const currentKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const windowEnd = windowEndFor(periodKey, currentKey);
  if (!windowEnd) return null;
  const hit = cache.get(windowEnd);
  let entry = hit && Date.now() - hit.at < CACHE_MS ? hit : null;
  if (!entry) {
    entry = { at: Date.now(), value: buildContext(windowEnd) };
    cache.set(windowEnd, entry);
  }
  const ctx = await entry.value.catch((error) => {
    cache.delete(windowEnd);
    throw error;
  });
  return ctx ? turnoverMetric(key, ctx) : null;
}
