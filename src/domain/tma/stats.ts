import type { TmaRowInput } from "./parse";

/** Meta do TMA: 3 horas. */
export const TMA_TARGET_MIN = 180;

export type TmaStatsRow = Pick<
  TmaRowInput,
  "status" | "agendamento" | "apresentacao" | "liberacao" | "tmaMin" | "atendimentoMin" | "patioMin" | "esperaMin" | "tmcMin" | "amarracaoMin" | "liberacaoMin" | "transportadora" | "destino" | "conferente" | "turno"
>;

const avg = (values: number[]) => (values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100);
const present = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Entra na média do TMA (tempo de atendimento: entrada no atendimento → liberação) o caminhão LIBERADO com tempo válido; liberado master,
 * não apresentou, furo etc. ficam de fora. */
export function countsForTma(row: TmaStatsRow): boolean {
  return row.status === "LIBERADO" && present(row.atendimentoMin) && row.atendimentoMin > 0;
}

/** Entra na média do TMA da planilha da Ambev (que conta a espera no pátio de quem chega antes do agendamento). */
export function countsForAmbev(row: TmaStatsRow): boolean {
  return row.status === "LIBERADO" && present(row.tmaMin) && row.tmaMin > 0;
}

export type GroupStat = { name: string; count: number; avgTma: number | null; within3h: number | null };

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
      avgTma: avg(list.map((r) => r.atendimentoMin!)),
      within3h: Math.round((list.filter((r) => r.atendimentoMin! <= TMA_TARGET_MIN).length / list.length) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

export type TmaStats = {
  /** Caminhões liberados que entram na média do TMA (tempo de atendimento: entrada no atendimento → liberação). */
  loaded: number;
  avgTma: number | null;
  /** % dos liberados atendidos em até 3 horas. */
  within3h: number | null;
  /** TMA da planilha da Ambev (inclui a espera no pátio de quem chega antes do agendamento). */
  ambev: { count: number; avg: number | null; within3h: number | null };
  avgTmc: number | null;
  stages: { patio: number | null; espera: number | null; carregamento: number | null; amarracao: number | null; liberacao: number | null };
  /** % dos carregados que tinham agendamento. */
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

export function computeTmaStats(rows: TmaStatsRow[]): TmaStats {
  const counted = rows.filter(countsForTma);
  const ambevRows = rows.filter(countsForAmbev);
  const loadedAll = rows.filter((r) => r.status === "LIBERADO");
  const scheduled = loadedAll.filter((r) => r.agendamento).length;
  const timed = loadedAll.filter((r) => r.agendamento && r.apresentacao);
  const onTime = timed.filter((r) => r.apresentacao! <= r.agendamento!).length;

  const days = new Map<string, number[]>();
  for (const r of counted) {
    if (!r.liberacao) continue;
    const day = r.liberacao.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), r.atendimentoMin!]);
  }

  return {
    loaded: counted.length,
    avgTma: avg(counted.map((r) => r.atendimentoMin!)),
    within3h: counted.length === 0 ? null : Math.round((counted.filter((r) => r.atendimentoMin! <= TMA_TARGET_MIN).length / counted.length) * 1000) / 10,
    ambev: {
      count: ambevRows.length,
      avg: avg(ambevRows.map((r) => r.tmaMin!)),
      within3h: ambevRows.length === 0 ? null : Math.round((ambevRows.filter((r) => r.tmaMin! <= TMA_TARGET_MIN).length / ambevRows.length) * 1000) / 10,
    },
    avgTmc: avg(counted.map((r) => r.tmcMin).filter((v): v is number => present(v) && v > 0)),
    stages: {
      patio: avg(counted.map((r) => r.patioMin).filter(present)),
      espera: avg(counted.map((r) => r.esperaMin).filter(present)),
      carregamento: avg(counted.map((r) => r.tmcMin).filter((v): v is number => present(v) && v > 0)),
      amarracao: avg(counted.map((r) => r.amarracaoMin).filter(present)),
      liberacao: avg(counted.map((r) => r.liberacaoMin).filter(present)),
    },
    withSchedule: loadedAll.length === 0 ? null : Math.round((scheduled / loadedAll.length) * 1000) / 10,
    onTime: timed.length === 0 ? null : Math.round((onTime / timed.length) * 1000) / 10,
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

/** Chaves de indicador do cascateamento ligadas ao TMA: `tma.avg` (tempo de atendimento), `tma.ambev` (TMA da planilha da Ambev), `tma.within3h`, `tma.tmc`, `tma.stage:patio|espera|carregamento|amarracao|liberacao`;
 * o sufixo `.ytd` (antes dos dois-pontos) pede o acumulado do ano. */
export function parseTmaKey(key: string): { metric: "avg" | "ambev" | "within3h" | "tmc" | "stage"; ytd: boolean; stage: string | null } | null {
  const m = /^tma\.(avg|ambev|within3h|tmc|stage)(\.ytd)?(?::([a-z]+))?$/.exec(key);
  if (!m) return null;
  if (m[1] === "stage" && !m[3]) return null;
  return { metric: m[1] as "avg" | "ambev" | "within3h" | "tmc" | "stage", ytd: !!m[2], stage: m[3] ?? null };
}

export function tmaMetricValue(stats: TmaStats, parsed: NonNullable<ReturnType<typeof parseTmaKey>>): number | null {
  if (stats.loaded === 0) return null;
  switch (parsed.metric) {
    case "avg":
      return stats.avgTma;
    case "ambev":
      return stats.ambev.avg;
    case "within3h":
      return stats.within3h;
    case "tmc":
      return stats.avgTmc;
    case "stage":
      return (stats.stages as Record<string, number | null>)[parsed.stage ?? ""] ?? null;
  }
}
