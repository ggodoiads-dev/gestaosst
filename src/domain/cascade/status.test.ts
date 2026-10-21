import { describe, it, expect } from "vitest";
import { diagnose, evaluateNode, expectedTarget, formatCascadeValue, rollupIvs } from "./status";

const base = { polarity: "HIGHER" as const, pace: "NONE" as const, periodKey: "2026-09", todayKey: "2026-10-22" };

describe("evaluateNode", () => {
  it("maior é melhor: bate quando o resultado alcança a meta", () => {
    expect(evaluateNode({ ...base, value: 97.41, target: 100 }).status).toBe("FAIL");
    expect(evaluateNode({ ...base, value: 100, target: 100 }).status).toBe("OK");
  });
  it("menor é melhor: bate quando o resultado fica até a meta", () => {
    expect(evaluateNode({ ...base, polarity: "LOWER", value: 1, target: 0 }).status).toBe("FAIL");
    expect(evaluateNode({ ...base, polarity: "LOWER", value: 56.97, target: 74.08 }).status).toBe("OK");
  });
  it("sem dado ou sem meta", () => {
    expect(evaluateNode({ ...base, value: null, target: 10 }).status).toBe("NO_DATA");
    expect(evaluateNode({ ...base, value: 5, target: null }).status).toBe("NO_TARGET");
  });
  it("meta anual é proporcional ao mês do resultado (DTO 13 de 216 em setembro)", () => {
    const r = evaluateNode({ ...base, pace: "YEAR", value: 13, target: 216 });
    expect(r.expected).toBe(162);
    expect(r.status).toBe("FAIL");
    expect(evaluateNode({ ...base, pace: "YEAR", value: 170, target: 216 }).status).toBe("OK");
  });
  it("progresso fica entre 0 e 1", () => {
    expect(evaluateNode({ ...base, value: 300, target: 100 }).progress).toBe(1);
    expect(evaluateNode({ ...base, value: 50, target: 100 }).progress).toBe(0.5);
  });
});

describe("expectedTarget", () => {
  it("meta mensal é proporcional aos dias só no mês corrente", () => {
    const args = { target: 18, polarity: "HIGHER" as const, pace: "MONTH" as const };
    expect(expectedTarget({ ...args, periodKey: "2026-10", todayKey: "2026-10-15" })).toBeCloseTo((18 * 15) / 31);
    expect(expectedTarget({ ...args, periodKey: "2026-09", todayKey: "2026-10-15" })).toBe(18);
  });
});

describe("rollupIvs e diagnose", () => {
  it("resume os IVs", () => {
    expect(rollupIvs([])).toBe("NONE");
    expect(rollupIvs(["OK", "OK"])).toBe("ALL_OK");
    expect(rollupIvs(["OK", "FAIL"])).toBe("SOME_FAIL");
    expect(rollupIvs(["NO_DATA", "NO_TARGET"])).toBe("NO_DATA");
  });
  it("cruza resultado e processo", () => {
    expect(diagnose("FAIL", "ALL_OK").title).toBe("Rotina em dia, resultado fora");
    expect(diagnose("FAIL", "SOME_FAIL").title).toBe("Rotina falhando");
    expect(diagnose("OK", "SOME_FAIL").title).toBe("Resultado vindo, rotina não sustenta");
    expect(diagnose("OK", "ALL_OK").title).toBe("Em dia");
    expect(diagnose("OK", "NONE").title).toBe("Sem desdobramento");
  });
});

describe("formatCascadeValue", () => {
  it("formata por unidade", () => {
    expect(formatCascadeValue("PERCENT", 97.41)).toBe("97,41%");
    expect(formatCascadeValue("MINUTES", 3 + 49 / 60)).toBe("3:49");
    expect(formatCascadeValue("MINUTES", 40)).toBe("40:00");
    expect(formatCascadeValue("MINUTES", 75)).toBe("1h15");
    expect(formatCascadeValue("NUMBER", null)).toBe("—");
  });
});
