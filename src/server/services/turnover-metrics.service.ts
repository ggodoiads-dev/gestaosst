import "server-only";
import { db } from "@/server/db";
import { countsAsTurnover, effectiveKind, tenureDays } from "@/domain/termination/rules";
import { buildYearResults, yearMonthInputs } from "@/domain/termination/pdca";
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
  const yearStart = new Date(endYear, 0, 1);
  const windowEndDate = new Date(endYear, endIdx + 1, 1);
  const now = new Date();

  const [presence, headcountBase, all] = await Promise.all([loadPresence(), loadHeadcountBase(), db.termination.findMany({ orderBy: { terminationDate: "asc" } })]);
  const counted = all.filter((t) => countsAsTurnover(effectiveKind(t.kind, t.reason)));

  // Conta do BI: demissões do mês ÷ QLP do mês e demissões do ano ÷ QLP médio do ano.
  const results = buildYearResults(yearMonthInputs({ year: endYear, lastIdx: endIdx, now, counted, people: presence.people, headcountBase }));
  const last = results[endIdx] ?? null;

  const inWindow = counted.filter((t) => t.terminationDate >= yearStart && t.terminationDate < windowEndDate);
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
  const platformMotives = new Map<string, { peak: number | null; byBucket: Map<string, number | null> }>();
  const motivos = survey.motivos?.data;
  for (const row of motivos?.rows ?? []) {
    const byBucket = new Map<string, number | null>();
    motivos!.buckets.forEach((b, i) => byBucket.set(surveyKey(b), row.values[i] ?? null));
    const known = row.values.filter((v): v is number => v !== null);
    platformMotives.set(surveyKey(row.motivo), { peak: known.length ? Math.max(...known) : null, byBucket });
  }
  return { monthRate: last?.rate ?? null, ytdRate: last?.ytdRate ?? null, exits, satisfaction: { byCategory, total: survey.satisfacao?.data.total ?? null }, platformMotives };
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
