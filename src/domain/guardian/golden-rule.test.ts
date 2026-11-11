import { describe, it, expect } from "vitest";
import { clampPeriodToMonth, isGoldenRule, looksLikeLeadership, parseDayKey, reportedPerson } from "./golden-rule";

describe("isGoldenRule", () => {
  it("só 'Sim' conta (qualquer caixa/acento), vazio e 'Não' não", () => {
    expect(isGoldenRule(JSON.stringify({ "Regra de Ouro": "Sim" }))).toBe(true);
    expect(isGoldenRule(JSON.stringify({ "REGRA DE OURO": "sim" }))).toBe(true);
    expect(isGoldenRule(JSON.stringify({ "Regra de Ouro": "Não" }))).toBe(false);
    expect(isGoldenRule(JSON.stringify({ "Regra de Ouro": " " }))).toBe(false);
    expect(isGoldenRule(JSON.stringify({ Outra: "Sim" }))).toBe(false);
    expect(isGoldenRule(null)).toBe(false);
    expect(isGoldenRule("{quebrado")).toBe(false);
  });
});

describe("reportedPerson", () => {
  it("lê quem é o reportado da linha original", () => {
    expect(reportedPerson(JSON.stringify({ "Nome do Reportado": "FULANO", "Empresa do Reportado": "LOG20" }))).toEqual({ name: "FULANO", company: "LOG20", cargo: null });
  });
});

describe("looksLikeLeadership", () => {
  it("reconhece cargos de liderança pelo nome", () => {
    expect(looksLikeLeadership("Líder de Operação")).toBe(true);
    expect(looksLikeLeadership("SUPERVISOR DE LOGÍSTICA")).toBe(true);
    expect(looksLikeLeadership("Coordenadora")).toBe(true);
    expect(looksLikeLeadership("Operador de Empilhadeira")).toBe(false);
    expect(looksLikeLeadership("Amarrador")).toBe(false);
    expect(looksLikeLeadership(null)).toBe(false);
  });
});

describe("período", () => {
  it("valida dia", () => {
    expect(parseDayKey("2026-11-05")).toBe("2026-11-05");
    expect(parseDayKey("2026-02-31")).toBeNull();
    expect(parseDayKey("05/11/2026")).toBeNull();
  });
  it("prende ao mês, troca se invertido e ignora sem datas", () => {
    expect(clampPeriodToMonth("2026-11", null, null)).toBeNull();
    expect(clampPeriodToMonth("2026-11", "2026-11-05", "2026-11-11")).toEqual({ from: "2026-11-05", to: "2026-11-11" });
    expect(clampPeriodToMonth("2026-11", "2026-11-11", "2026-11-05")).toEqual({ from: "2026-11-05", to: "2026-11-11" });
    expect(clampPeriodToMonth("2026-11", "2026-10-20", "2026-12-10")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(clampPeriodToMonth("2026-11", "2026-12-02", "2026-12-10")).toBeNull();
    expect(clampPeriodToMonth("2026-11", "2026-11-20", null)).toEqual({ from: "2026-11-20", to: "2026-11-30" });
  });
});
