import { describe, expect, it } from "vitest";
import { diagnose, exitsBudget, goalStatus, rollingTurnover, type DiagnosisInput } from "./pdca";

const month = (exits: number, hs = 100, he = 100) => ({ exits, headcountStart: hs, headcountEnd: he });

describe("rollingTurnover", () => {
  it("12 meses com 1 saída para 100 pessoas dá 12%", () => {
    expect(rollingTurnover(Array.from({ length: 12 }, () => month(1)))).toBe(12);
  });
  it("usa a média do efetivo da janela", () => {
    expect(rollingTurnover([month(5, 90, 110), month(5, 110, 90)])).toBe(10);
  });
  it("sem base não calcula", () => {
    expect(rollingTurnover([])).toBeNull();
    expect(rollingTurnover([month(1, 0, 0)])).toBeNull();
  });
});

describe("goalStatus", () => {
  it("compara com a meta", () => {
    expect(goalStatus(13, 13.92)).toBe("DENTRO");
    expect(goalStatus(13.92, 13.92)).toBe("DENTRO");
    expect(goalStatus(15, 13.92)).toBe("ATENCAO");
    expect(goalStatus(20, 13.92)).toBe("FORA");
    expect(goalStatus(null, 13.92)).toBe("SEM_META");
    expect(goalStatus(10, null)).toBe("SEM_META");
  });
});

describe("exitsBudget", () => {
  it("quantos desligamentos ainda cabem", () => {
    expect(exitsBudget(14, 100, 10)).toBe(4);
    expect(exitsBudget(14, 100, 16)).toBe(-2);
    expect(exitsBudget(null, 100, 10)).toBeNull();
  });
});

const base: DiagnosisInput = { exits: 20, voluntary: 4, early90: 2, withTenure: 20, unclassified: 0, topArea: null, topTurno: null, topCargo: null, peakMonth: null };

describe("diagnose", () => {
  it("poucos desligamentos não conclui padrão", () => {
    expect(diagnose({ ...base, exits: 3 })[0]).toContain("Poucos desligamentos");
  });
  it("aponta saída precoce, pedido de demissão e concentração", () => {
    const out = diagnose({ ...base, early90: 8, voluntary: 12, topTurno: { label: "B", count: 10 } });
    expect(out.some((l) => l.includes("até 90 dias"))).toBe(true);
    expect(out.some((l) => l.includes("pedido de demissão"))).toBe(true);
    expect(out.some((l) => l.includes("um só turno: B"))).toBe(true);
  });
  it("sem padrão forte, diz isso", () => {
    expect(diagnose(base)[0]).toContain("Nenhum padrão forte");
  });
});
