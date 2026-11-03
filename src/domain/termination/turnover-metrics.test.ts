import { describe, expect, it } from "vitest";
import { turnoverMetric, windowEndFor, surveyKey, type TurnoverContext, type WindowExit } from "./turnover-metrics";

const ex = (o: Partial<WindowExit>): WindowExit => ({ kind: "VOLUNTARIO", tenureDays: 200, turno: "A", area: "Expedição", cargo: "Ajudante", interview: null, ...o });
const iv = (primaryReason: string, extra: Partial<NonNullable<WindowExit["interview"]>> = {}) => ({ primaryReason, ratings: {}, wouldReturn: null, ...extra });

const ctx = (exits: WindowExit[], rate: number | null = 18.75): TurnoverContext => ({
  monthRate: rate,
  ytdRate: rate === null ? null : 26.32,
  exits,
  satisfaction: { byCategory: new Map([["remuneracao", { satisfacao: 77.7, criticos: 8.3 }]]), total: { satisfacao: 80, criticos: 2.2 } },
  platformMotives: new Map([["gestorimediato", { peak: 18.8, byBucket: new Map([["6a12meses", 18.8], ["0a3meses", null]]) }]]),
});

describe("turnoverMetric", () => {
  const exits = [
    ex({ tenureDays: 30, interview: iv("BENEFICIOS", { ratings: { beneficios: 2 }, wouldReturn: "NAO" }) }),
    ex({ tenureDays: 80, turno: "B", interview: iv("BENEFICIOS", { ratings: { beneficios: 3 }, wouldReturn: "SIM" }) }),
    ex({ tenureDays: 400, interview: iv("SALARIO") }),
    ex({ kind: "INVOLUNTARIO", tenureDays: null }),
  ];
  const c = ctx(exits);

  it("turnover do mês e acumulado vêm calculados; a contagem é das saídas do ano", () => {
    expect(turnoverMetric("turnover.month", c)).toBe(18.75);
    expect(turnoverMetric("turnover.ytd", c)).toBe(26.32);
    expect(turnoverMetric("turnover.exits.ytd", c)).toBe(4);
  });
  it("sem QLP, sem número de turnover", () => {
    const c2 = ctx(exits, null);
    expect(turnoverMetric("turnover.month", c2)).toBeNull();
    expect(turnoverMetric("turnover.ytd", c2)).toBeNull();
  });
  it("percentuais sobre a base certa", () => {
    expect(turnoverMetric("turnover.voluntary.pct", c)).toBe(75);
    expect(turnoverMetric("turnover.early90.pct", c)).toBe(66.67); // 2 de 3 com data de admissão
    expect(turnoverMetric("turnover.interviews.coverage", c)).toBe(100); // 3 de 3 pedidos de demissão
    expect(turnoverMetric("turnover.wouldreturn.pct", c)).toBe(50);
  });
  it("motivo e nota usam só quem foi entrevistado", () => {
    expect(turnoverMetric("turnover.motive:BENEFICIOS", c)).toBe(66.67);
    expect(turnoverMetric("turnover.motive:LIDERANCA", c)).toBe(0);
    expect(turnoverMetric("turnover.rating:beneficios", c)).toBe(2.5);
    expect(turnoverMetric("turnover.rating:salario", c)).toBeNull();
  });
  it("turno, área e cargo (nome codificado)", () => {
    expect(turnoverMetric("turnover.turno:B", c)).toBe(25);
    expect(turnoverMetric(`turnover.area:${encodeURIComponent("Expedição")}`, c)).toBe(100);
    expect(turnoverMetric("turnover.cargo:Ajudante", c)).toBe(100);
  });
  it("plataforma", () => {
    expect(turnoverMetric(`turnover.platform.sat:${surveyKey("REMUNERAÇÃO")}`, c)).toBe(77.7);
    expect(turnoverMetric("turnover.platform.crit:remuneracao", c)).toBe(8.3);
    expect(turnoverMetric("turnover.platform.sat:total", c)).toBe(80);
    expect(turnoverMetric("turnover.platform.sat:inexistente", c)).toBeNull();
  });
  it("motivos da plataforma: maior % e % de cada faixa", () => {
    expect(turnoverMetric("turnover.platform.motive:gestorimediato", c)).toBe(18.8);
    expect(turnoverMetric("turnover.platform.motive:gestorimediato~6a12meses", c)).toBe(18.8);
    expect(turnoverMetric("turnover.platform.motive:gestorimediato~0a3meses", c)).toBeNull();
    expect(turnoverMetric("turnover.platform.motive:inexistente", c)).toBeNull();
  });
  it("sem entrevistas não inventa percentual", () => {
    const none = ctx([ex({}), ex({})]);
    expect(turnoverMetric("turnover.motive:BENEFICIOS", none)).toBeNull();
    expect(turnoverMetric("turnover.wouldreturn.pct", none)).toBeNull();
    expect(turnoverMetric("turnover.interviews.coverage", none)).toBe(0);
  });
  it("chave desconhecida dá null", () => {
    expect(turnoverMetric("turnover.xyz", c)).toBeNull();
  });
});

describe("windowEndFor", () => {
  it("o período vale ele mesmo (inclusive o corrente, até hoje); futuro não tem", () => {
    expect(windowEndFor("2026-09", "2026-11")).toBe("2026-09");
    expect(windowEndFor("2026-11", "2026-11")).toBe("2026-11");
    expect(windowEndFor("2027-01", "2026-12")).toBeNull();
  });
});
