import type { TmaRowInput } from "./parse";

/** Meta do TMA: 3 horas. */
export const TMA_TARGET_MIN = 180;

export type TmaStatsRow = Pick<
  TmaRowInput,
  "status" | "agendamento" | "apresentacao" | "liberacao" | "tmaMin" | "atendimentoMin" | "patioMin" | "esperaMin" | "tmcMin" | "amarracaoMin" | "liberacaoMin" | "transportadora" | "destino" | "conferente" | "turno"
> & {
  /** AAAA-MM da aba. Serve pra saber se a aba tem a coluna de agendamento (meses antigos não têm). */
  periodKey?: string;
};

const avg = (values: number[]) => (values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100);
const present = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Meses cuja aba tem agendamento preenchido. Nos meses sem nenhuma linha com agendamento (layout antigo, sem a coluna), todo caminhão vale. */
export function monthsWithSchedule(rows: TmaStatsRow[]): Set<string> {
  return new Set(rows.filter((r) => r.agendamento).map((r) => r.periodKey ?? ""));
}

/**
 * TMA oficial (o da planilha da Ambev, confirmado com o setembro: 4h06 reportado, 4h07 pelo cálculo): média da coluna TMA dos caminhões
 * LIBERADOS que TINHAM AGENDAMENTO. Quem veio sem agendamento fica fora (o TMA dele não é avaliável — e é enorme). Liberado master, não
 * apresentou, furo, dispensado e cancelado também ficam de fora.
 */
export function countsForTma(row: TmaStatsRow, scheduleMonths: Set<string>): boolean {
  if (row.status !== "LIBERADO" || !present(row.tmaMin) || row.tmaMin <= 0) return false;
  return !!row.agendamento || !scheduleMonths.has(row.periodKey ?? "");
}

/** Tempo de atendimento em si: da entrada no atendimento até a liberação (não conta a espera no pátio). */
export function countsForAtendimento(row: TmaStatsRow): boolean {
  return row.status === "LIBERADO" && present(row.atendimentoMin) && row.atendimentoMin > 0;
}

export type GroupStat = { name: string; count: number; avgTma: number | null; within3h: number | null; avgAmarracao: number | null };

function groupBy(rows: TmaStatsRow[], key: (r: TmaStatsRow) => string | null): GroupStat[] {
  const map = new Map<string, TmaStatsRow[]>();
  for (const r of rows) {
    const k = key(r) ?? "(sem informação)";
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      avgTma: avg(list.map((r) => r.tmaMin!)),
      within3h: Math.round((list.filter((r) => r.tmaMin! <= TMA_TARGET_MIN).length / list.length) * 1000) / 10,
      avgAmarracao: avg(list.map((r) => r.amarracaoMin).filter((v): v is number => present(v) && v > 0)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

export type TmaStats = {
  /** Caminhões que entram na média do TMA oficial. */
  loaded: number;
  /** TMA oficial (planilha da Ambev), em minutos. */
  avgTma: number | null;
  /** % dos caminhões do TMA atendidos em até 3 horas. */
  within3h: number | null;
  /** Tempo de atendimento: entrada no atendimento → liberação. */
  atendimento: { count: number; avg: number | null; within3h: number | null };
  avgTmc: number | null;
  stages: { patio: number | null; espera: number | null; carregamento: number | null; amarracao: number | null; liberacao: number | null };
  /** % dos liberados que tinham agendamento. */
  withSchedule: number | null;
  /** % que se apresentou no horário ou antes do agendado. */
  onTime: number | null;
  notShown: number;
  holes: number;
  releasedMaster: number;
  totalRows: number;
  byDay: { day: string; count: number; avgTma: number | null }[];
  byTransportadora: GroupStat[];
  byDestino: GroupStat[];
  byConferente: GroupStat[];
  byTurno: GroupStat[];
};

const pct1 = (part: number, total: number) => (total === 0 ? null : Math.round((part / total) * 1000) / 10);

export function computeTmaStats(rows: TmaStatsRow[]): TmaStats {
  const scheduleMonths = monthsWithSchedule(rows);
  const counted = rows.filter((r) => countsForTma(r, scheduleMonths));
  const atend = rows.filter(countsForAtendimento);
  const loadedAll = rows.filter((r) => r.status === "LIBERADO");
  const scheduled = loadedAll.filter((r) => r.agendamento).length;
  const timed = loadedAll.filter((r) => r.agendamento && r.apresentacao);
  const onTime = timed.filter((r) => r.apresentacao! <= r.agendamento!).length;

  const days = new Map<string, number[]>();
  for (const r of counted) {
    if (!r.liberacao) continue;
    const day = r.liberacao.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), r.tmaMin!]);
  }
  const positive = (list: (number | null)[]) => list.filter((v): v is number => present(v) && v > 0);

  return {
    loaded: counted.length,
    avgTma: avg(counted.map((r) => r.tmaMin!)),
    within3h: pct1(counted.filter((r) => r.tmaMin! <= TMA_TARGET_MIN).length, counted.length),
    atendimento: {
      count: atend.length,
      avg: avg(atend.map((r) => r.atendimentoMin!)),
      within3h: pct1(atend.filter((r) => r.atendimentoMin! <= TMA_TARGET_MIN).length, atend.length),
    },
    avgTmc: avg(positive(atend.map((r) => r.tmcMin))),
    stages: {
      patio: avg(atend.map((r) => r.patioMin).filter(present)),
      espera: avg(atend.map((r) => r.esperaMin).filter(present)),
      carregamento: avg(positive(atend.map((r) => r.tmcMin))),
      amarracao: avg(atend.map((r) => r.amarracaoMin).filter(present)),
      liberacao: avg(atend.map((r) => r.liberacaoMin).filter(present)),
    },
    withSchedule: pct1(scheduled, loadedAll.length),
    onTime: pct1(onTime, timed.length),
    notShown: rows.filter((r) => r.status === "NAO APRESENTOU" || r.status === "NÃO APRESENTOU").length,
    holes: rows.filter((r) => r.status === "FURO").length,
    releasedMaster: rows.filter((r) => r.status === "LIBERADO MASTER").length,
    totalRows: rows.length,
    byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, count: list.length, avgTma: avg(list) })),
    byTransportadora: groupBy(counted, (r) => r.transportadora),
    byDestino: groupBy(counted, (r) => r.destino),
    byConferente: groupBy(counted, (r) => r.conferente),
    byTurno: groupBy(counted, (r) => r.turno),
  };
}

/** Minutos → "h:mm" (5h09 → "5:09"). */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Chaves de indicador do cascateamento ligadas ao TMA: `tma.avg` (TMA oficial da planilha), `tma.atendimento` (entrada → liberação), `tma.within3h`,
 * `tma.tmc`, `tma.stage:patio|espera|carregamento|amarracao|liberacao`; `tma.ambev` é um apelido antigo de `tma.avg`. O sufixo `.ytd`
 * (antes dos dois-pontos) pede o acumulado do ano. */
export function parseTmaKey(key: string): { metric: "avg" | "atendimento" | "within3h" | "tmc" | "stage"; ytd: boolean; stage: string | null } | null {
  const m = /^tma\.(avg|ambev|atendimento|within3h|tmc|stage)(\.ytd)?(?::([a-z]+))?$/.exec(key);
  if (!m) return null;
  if (m[1] === "stage" && !m[3]) return null;
  return { metric: (m[1] === "ambev" ? "avg" : m[1]) as "avg" | "atendimento" | "within3h" | "tmc" | "stage", ytd: !!m[2], stage: m[3] ?? null };
}

export function tmaMetricValue(stats: TmaStats, parsed: NonNullable<ReturnType<typeof parseTmaKey>>): number | null {
  switch (parsed.metric) {
    case "avg":
      return stats.loaded === 0 ? null : stats.avgTma;
    case "atendimento":
      return stats.atendimento.avg;
    case "within3h":
      return stats.loaded === 0 ? null : stats.within3h;
    case "tmc":
      return stats.avgTmc;
    case "stage":
      return (stats.stages as Record<string, number | null>)[parsed.stage ?? ""] ?? null;
  }
}
