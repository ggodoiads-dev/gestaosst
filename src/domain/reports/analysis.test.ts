import { describe, expect, it } from "vitest";
import { accidentFindings, checklistFindings, dayLabel, deltaText, guardianFindings, nonconformityFindings, pctDelta, sameDayCompare, sortFindings, tmaFindings, trendTone } from "./analysis";

describe("comparação com o mês anterior", () => {
  it("variação percentual e texto", () => {
    expect(pctDelta(110, 100)).toBe(10);
    expect(pctDelta(5, 0)).toBeNull();
    expect(deltaText(110, 100, "pct")).toBe("+10% vs. mês anterior");
    expect(deltaText(90, 100, "pct")).toBe("−10% vs. mês anterior");
    expect(deltaText(77, 100, "pts")).toBe("−23 pts vs. mês anterior");
    expect(deltaText(4, 4, "abs")).toBe("= mês anterior");
    expect(deltaText(null, 4)).toBeUndefined();
  });
  it("tom depende de subir ser bom ou ruim", () => {
    expect(trendTone(120, 100, true)).toBe("good");
    expect(trendTone(120, 100, false)).toBe("bad");
    expect(trendTone(101, 100, true)).toBe("neutral");
  });
});

describe("pontos críticos", () => {
  it("SIF real é crítico; SIF potencial é alto; sem ocorrência vira informação", () => {
    expect(accidentFindings({ total: 2, prevTotal: 1, withInjury: 0, sif: 1, sifReal: 1, latestCodes: ["ACID-1"] })[0].severity).toBe("CRITICO");
    expect(accidentFindings({ total: 2, prevTotal: 1, withInjury: 0, sif: 2, sifReal: 0, latestCodes: [] })[0].severity).toBe("ALTO");
    expect(accidentFindings({ total: 0, prevTotal: 1, withInjury: 0, sif: 0, sifReal: 0, latestCodes: [] })[0].severity).toBe("INFO");
  });
  it("adesão do Guardian: faixas e queda", () => {
    const f = guardianFindings({ adherence: 35, prevAdherence: 100, notReported: 50, scheduled: 78, worstTurno: { name: "B", count: 7 }, internal: true });
    expect(f.map((x) => x.severity)).toEqual(["CRITICO", "ALTO"]);
    expect(guardianFindings({ adherence: 95, prevAdherence: 96, notReported: 2, scheduled: 60, worstTurno: null, internal: true })).toEqual([]);
  });
  it("checklist por faixa", () => {
    expect(checklistFindings({ percent: 65, prevPercent: 80, pendingShifts: 20, isCurrentMonth: false })[0].severity).toBe("ALTO");
    expect(checklistFindings({ percent: 100, prevPercent: 100, pendingShifts: 0, isCurrentMonth: true })).toEqual([]);
  });
  it("NC crítica aberta e ação vencida aparecem; ordem por gravidade", () => {
    const f = sortFindings(nonconformityFindings({ openCritical: 2, oldestCriticalDays: 40, openOver30: 3, openTotal: 19, withoutResponsible: 5, overdueActions: 1, blockedEquipments: 2 }));
    expect(f[0].severity).toBe("CRITICO");
    expect(f.some((x) => x.module === "Planos de ação")).toBe(true);
    expect(f[f.length - 1].severity).toBe("ATENCAO");
  });
  it("TMA acima da meta", () => {
    expect(tmaFindings({ avgMin: 250, prevAvgMin: 200, within3h: 40, targetMin: 180 }).map((x) => x.severity)).toEqual(["CRITICO", "ATENCAO", "ATENCAO"]);
    expect(tmaFindings({ avgMin: 170, prevAvgMin: 170, within3h: 70, targetMin: 180 })).toEqual([]);
  });
});

describe("comparação no mesmo ponto do mês passado", () => {
  it("dayLabel escreve o dia e o mês abreviado", () => {
    expect(dayLabel("2026-10", 4)).toBe("04/out");
    expect(dayLabel("2026-01", 31)).toBe("31/jan");
  });
  it("texto: até o dia, valor de lá e a diferença em pontos", () => {
    const r = sameDayCompare(30, 100, "04/out");
    expect(r?.delta).toBe("até 04/out: 100% · −70 pts");
    expect(r?.sameDay).toEqual({ cut: "04/out", cur: 30, prev: 100 });
    expect(sameDayCompare(72, 27, "03/out")?.delta).toBe("até 03/out: 27% · +45 pts");
    expect(sameDayCompare(50, 50, "03/out")?.delta).toBe("até 03/out: 50% · igual");
  });
  it("sem um dos valores, não compara", () => {
    expect(sameDayCompare(null, 50, "04/out")).toBeUndefined();
    expect(sameDayCompare(50, null, "04/out")).toBeUndefined();
  });
});
