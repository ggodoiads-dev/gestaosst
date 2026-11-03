import { describe, expect, it } from "vitest";
import { turnoverMetric, windowEndFor, surveyKey, type TurnoverContext, type WindowExit } from "./turnover-metrics";

const ex = (o: Partial<WindowExit>): WindowExit => ({ kind: "VOLUNTARIO", tenureDays: 200, turno: "A", area: "Expedição", cargo: "Ajudante", interview: null, ...o });
const iv = (primaryReason: string, extra: Partial<NonNullable<WindowExit["interview"]>> = {}) => ({ primaryReason, ratings: {}, wouldReturn: null, ...extra });

const ctx = (exits: WindowExit[], rate: number | null = 15.3): TurnoverContext => ({
  rate,
  exits,
  satisfaction: { byCategory: new Map([["remuneracao", { satisfacao: 77.7, criticos: 8.3 }]]), total: { satisfacao: 80, criticos: 2.2 } },
});

describe("turnoverMetric", () => {
  const exits = [
    ex({ tenureDays: 30, interview: iv("BENEFICIOS", { ratings: { beneficios: 2 }, wouldReturn: "NAO" }) }),
    ex({ tenureDays: 80, turno: "B", interview: iv("BENEFICIOS", { ratings: { beneficios: 3 }, wouldReturn: "SIM" }) }),
    ex({ tenureDays: 400, interview: iv("SALARIO") }),
    ex({ kind: "INVOLUNTARIO", tenureDays: null }),
  ];
  const c = ctx(exits);

  it("turnover e contagem vêm da janela", () => {
    expect(turnoverMetric("turnover.rolling12", c)).toBe(15.3);
    expect(turnoverMetric("turnover.rolling12.ytd", c)).toBe(15.3);
    expect(turnoverMetric("turnover.exits12", c)).toBe(4);
  });
  it("sem janela coberta, sem número", () => {
    const c2 = ctx(exits, null);
    expect(turnoverMetric("turnover.rolling12", c2)).toBeNull();
    expect(turnoverMetric("turnover.exits12", c2)).toBeNull();
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
  it("mês fechado vale ele mesmo; mês corrente usa o anterior; futuro não tem", () => {
    expect(windowEndFor("2026-09", "2026-11")).toBe("2026-09");
    expect(windowEndFor("2026-11", "2026-11")).toBe("2026-10");
    expect(windowEndFor("2027-01", "2026-12")).toBeNull();
    expect(windowEndFor("2026-01", "2026-01")).toBe("2025-12");
  });
});
