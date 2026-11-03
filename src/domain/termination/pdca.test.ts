import { describe, expect, it } from "vitest";
import { buildYearResults, diagnose, exitsBudget, goalStatus, qlpRate, yearMonthInputs, type DiagnosisInput } from "./pdca";

const m = (month: string, exits: number, qlp: number) => ({ month, exits, qlp, qlpSource: "oficial" as const });

describe("qlpRate", () => {
  it("demissões ÷ QLP com 2 casas, como o BI", () => {
    expect(qlpRate(15, 57)).toBe(26.32);
    expect(qlpRate(1, 54)).toBe(1.85);
    expect(qlpRate(0, 57)).toBe(0);
  });
  it("sem QLP não calcula", () => {
    expect(qlpRate(3, 0)).toBeNull();
  });
});

describe("buildYearResults", () => {
  it("mês = demissões do mês ÷ QLP do mês; acumulado = demissões do ano ÷ média do QLP", () => {
    const r = buildYearResults([m("2026-01", 0, 54), m("2026-02", 1, 54), m("2026-03", 2, 60)]);
    expect(r[1].rate).toBe(1.85);
    expect(r[2].rate).toBe(3.33);
    expect(r[2].ytdExits).toBe(3);
    expect(r[2].ytdQlp).toBe(56);
    expect(r[2].ytdRate).toBe(5.36); // 3 ÷ 56
  });
  it("reproduz o BI: 15 demissões no ano com QLP médio 57 dá 26,32%", () => {
    const qlps = [54, 54, 54, 54, 54, 54, 54, 54, 64, 64]; // média 56,6 ≈ 57 (exemplo)
    const r = buildYearResults(qlps.map((q, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, i === 1 ? 1 : i === 9 ? 12 : i === 4 ? 2 : 0, q)));
    expect(r[r.length - 1].ytdExits).toBe(15);
    expect(r[r.length - 1].ytdRate).toBeCloseTo((15 / 56) * 100, 1);
  });
  it("vazio dá lista vazia", () => {
    expect(buildYearResults([])).toEqual([]);
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

describe("yearMonthInputs", () => {
  const people = Array.from({ length: 50 }, () => ({ admissionDate: new Date(2020, 0, 1), departureDate: null }));
  const counted = [{ terminationDate: new Date(2026, 1, 10) }, { terminationDate: new Date(2026, 1, 20) }, { terminationDate: new Date(2026, 2, 5) }];
  it("conta as saídas de cada mês e usa o QLP informado; sem ele, estima pelo cadastro", () => {
    const r = yearMonthInputs({ year: 2026, lastIdx: 2, now: new Date(2026, 3, 15), counted, people, headcountBase: new Map([["2026-02", 54]]) });
    expect(r.map((x) => x.exits)).toEqual([0, 2, 1]);
    expect(r[1]).toMatchObject({ qlp: 54, qlpSource: "oficial" });
    expect(r[0]).toMatchObject({ qlp: 50, qlpSource: "cadastro" });
  });
  it("mês sem QLP informado repete o último informado antes dele (QLP fixo)", () => {
    const r = yearMonthInputs({ year: 2026, lastIdx: 3, now: new Date(2026, 4, 15), counted: [], people, headcountBase: new Map([["2026-02", 57]]) });
    expect(r.map((x) => x.qlp)).toEqual([50, 57, 57, 57]);
    expect(r.map((x) => x.qlpSource)).toEqual(["cadastro", "oficial", "oficial", "oficial"]);
  });
  it("sem mês fechado, nada", () => {
    expect(yearMonthInputs({ year: 2026, lastIdx: -1, now: new Date(2026, 0, 10), counted, people, headcountBase: new Map() })).toEqual([]);
  });
});
