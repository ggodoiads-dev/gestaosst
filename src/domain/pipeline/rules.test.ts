import { describe, expect, it } from "vitest";
import { cycleBands, isTurnoverRisk, monthsBetween, parseCriticality, parseDue, parseIccResult, parsePotential, parseReadiness, parsePositionStatus, positionRisk, summarizePositions, tenureSummary } from "./rules";

describe("positionRisk", () => {
  it("criticidade Alta: pronto agora = baixo; até 6 meses = médio; o resto, inclusive sem sucessor, = alto", () => {
    expect(positionRisk("ALTA", "AGORA")).toBe("BAIXO");
    expect(positionRisk("ALTA", "ATE_6M")).toBe("MEDIO");
    expect(positionRisk("ALTA", "ATE_1A")).toBe("ALTO");
    expect(positionRisk("ALTA", "MAIS_1A")).toBe("ALTO");
    expect(positionRisk("ALTA", null)).toBe("ALTO");
  });
  it("criticidade Média e Baixa", () => {
    expect(positionRisk("MEDIA", "AGORA")).toBe("BAIXO");
    expect(positionRisk("MEDIA", "ATE_1A")).toBe("MEDIO");
    expect(positionRisk("MEDIA", null)).toBe("MEDIO");
    expect(positionRisk("BAIXA", null)).toBe("BAIXO");
  });
});

describe("summarizePositions", () => {
  it("percentuais sobre o total de cargos", () => {
    const s = summarizePositions([
      { criticality: "ALTA", readiness: "ATE_6M", potential: "ALTO" },
      { criticality: "ALTA", readiness: null, potential: "MEDIO" },
      { criticality: "BAIXA", readiness: null, potential: null },
      { criticality: "MEDIA", readiness: "AGORA", potential: "BAIXO" },
    ]);
    expect(s.total).toBe(4);
    expect(s.criticality.find((r) => r.key === "ALTA")).toMatchObject({ count: 2, pct: 50 });
    expect(s.risk.find((r) => r.key === "ALTO")).toMatchObject({ count: 1, pct: 25 });
    expect(s.potential.find((r) => r.key === "ALTO")?.count).toBe(1);
    expect(s.readiness.find((r) => r.key === "AGORA")?.count).toBe(1);
  });
  it("sem cargos, tudo zero", () => {
    expect(summarizePositions([]).risk.every((r) => r.count === 0 && r.pct === 0)).toBe(true);
  });
});

describe("tenureSummary", () => {
  it("faixas da planilha e média", () => {
    const s = tenureSummary([3, 6, 11, 12, 23, 24, 40]);
    expect(s.bands.map((b) => b.count)).toEqual([1, 2, 2, 2]);
    expect(s.total).toBe(7);
    expect(s.averageMonths).toBe(17);
  });
  it("sem dados, sem média", () => {
    expect(tenureSummary([]).averageMonths).toBeNull();
  });
  it("monthsBetween conta meses completos", () => {
    expect(monthsBetween(new Date(2025, 9, 7), new Date(2026, 10, 3))).toBe(12);
    expect(monthsBetween(new Date(2026, 10, 10), new Date(2026, 10, 3))).toBe(0);
  });
});

describe("cycleBands e risco de turnover", () => {
  it("conta por faixa; sem resultado vai para Não Informado", () => {
    const b = cycleBands([{ iccResult: "POSITIVA" }, { iccResult: "NEGATIVA" }, { iccResult: null }, { iccResult: "NEGATIVA" }]);
    expect(b.find((x) => x.key === "NEGATIVA")).toMatchObject({ count: 2, pct: 50 });
    expect(b.find((x) => x.key === "NAO_INFORMADO")?.count).toBe(1);
  });
  it("sem ninguém, percentual nulo", () => {
    expect(cycleBands([])[0].pct).toBeNull();
  });
  it("só negativa e muito negativa entram no risco", () => {
    expect(isTurnoverRisk({ iccResult: "NEGATIVA" })).toBe(true);
    expect(isTurnoverRisk({ iccResult: "MUITO_NEGATIVA" })).toBe(true);
    expect(isTurnoverRisk({ iccResult: "SATISFATORIA" })).toBe(false);
  });
});

describe("leitura da planilha", () => {
  it("criticidade, prontidão, potencial e status, com e sem acento/emoji", () => {
    expect(parseCriticality("Média")).toBe("MEDIA");
    expect(parseCriticality("alta")).toBe("ALTA");
    expect(parseReadiness("Ate 6 meses")).toBe("ATE_6M");
    expect(parseReadiness("Até 6 meses")).toBe("ATE_6M");
    expect(parseReadiness("Pronto agora")).toBe("AGORA");
    expect(parseReadiness(" + 1 ano")).toBe("MAIS_1A");
    expect(parsePotential("🚀 High Potential")).toBe("ALTO");
    expect(parsePotential("🟡 Potencial Médio")).toBe("MEDIO");
    expect(parsePotential("🔴 Potencial Baixo")).toBe("BAIXO");
    expect(parsePositionStatus("Concluído")).toBe("CONCLUIDO");
    expect(parsePositionStatus("xyz")).toBeNull();
  });
  it("resultado do ciclo", () => {
    expect(parseIccResult("Muito Positiva")).toBe("MUITO_POSITIVA");
    expect(parseIccResult("Satisfatória")).toBe("SATISFATORIA");
    expect(parseIccResult("negativa")).toBe("NEGATIVA");
    expect(parseIccResult("")).toBe("NAO_INFORMADO");
  });
  it("prazo: data, mês por extenso ou texto", () => {
    expect(parseDue("março", 2026).date).toEqual(new Date(2026, 2, 31));
    expect(parseDue("março", 2026).note).toBe("março");
    expect(parseDue("17/03/2026", 2026).date).toEqual(new Date(2026, 2, 17));
    expect(parseDue("depois da integração", 2026)).toEqual({ date: null, note: "depois da integração" });
    expect(parseDue(null, 2026)).toEqual({ date: null, note: null });
  });
});
