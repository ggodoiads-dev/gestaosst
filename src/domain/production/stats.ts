import { PRODUCTION_FIELDS, totalOfGroup, type ProductionValues } from "./fields";

export type ShiftReport = {
  id: string;
  /** AAAA-MM-DD */
  day: string;
  turno: string;
  values: ProductionValues;
  notes: string | null;
};

export type TurnoStat = { turno: string; reports: number; totals: ProductionValues };
export type DayStat = { day: string; carrosCarregados: number; carrosTrabalhados: number; carrosAmarrados: number; reports: number };

export type ProductionStats = {
  reports: number;
  /** Dias com pelo menos um relatório. */
  daysWithReport: number;
  totals: ProductionValues;
  cargasTotal: number;
  descargasTotal: number;
  /** Carros carregados ÷ carros trabalhados (%), quando os dois foram informados. */
  loadedRate: number | null;
  avgLoadedPerDay: number | null;
  byTurno: TurnoStat[];
  byDay: DayStat[];
};

function sumValues(list: ProductionValues[]): ProductionValues {
  const out: ProductionValues = {};
  for (const field of PRODUCTION_FIELDS) {
    let any = false;
    let total = 0;
    for (const v of list) {
      if (typeof v[field.key] === "number") {
        any = true;
        total += v[field.key];
      }
    }
    if (any) out[field.key] = total;
  }
  return out;
}

export function computeProductionStats(reports: ShiftReport[]): ProductionStats {
  const totals = sumValues(reports.map((r) => r.values));

  const days = new Map<string, ShiftReport[]>();
  const turnos = new Map<string, ShiftReport[]>();
  for (const r of reports) {
    days.set(r.day, [...(days.get(r.day) ?? []), r]);
    turnos.set(r.turno, [...(turnos.get(r.turno) ?? []), r]);
  }

  const byDay: DayStat[] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => {
      const t = sumValues(list.map((r) => r.values));
      return { day, carrosCarregados: t.carrosCarregados ?? 0, carrosTrabalhados: t.carrosTrabalhados ?? 0, carrosAmarrados: t.carrosAmarrados ?? 0, reports: list.length };
    });

  const byTurno: TurnoStat[] = [...turnos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([turno, list]) => ({ turno, reports: list.length, totals: sumValues(list.map((r) => r.values)) }));

  const worked = totals.carrosTrabalhados ?? 0;
  const loaded = totals.carrosCarregados ?? 0;
  return {
    reports: reports.length,
    daysWithReport: days.size,
    totals,
    cargasTotal: totalOfGroup(totals, "CARGAS"),
    descargasTotal: totalOfGroup(totals, "DESCARGAS"),
    loadedRate: worked > 0 ? Math.round((loaded / worked) * 1000) / 10 : null,
    avgLoadedPerDay: days.size > 0 && totals.carrosCarregados !== undefined ? Math.round((loaded / days.size) * 10) / 10 : null,
    byTurno,
    byDay,
  };
}
