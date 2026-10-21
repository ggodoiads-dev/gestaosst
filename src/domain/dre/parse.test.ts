import { describe, it, expect } from "vitest";
import { parseBrNumber, parseDreGrid } from "./parse";
import { avrPercent, parseDreKey, ratioPercent, sumAmounts } from "./metrics";

const grid: unknown[][] = [
  ["DEMONSTRATIVO DE RESULTADOS"],
  [],
  ["UNIDADES SELECIONADAS: TOTAL CARAMBEI", null, null, null, null, null, "OFICIAL ATUALIZADO EM:"],
  [null, null, null, null, null, null, "14/10/2026 07:32"],
  [],
  [],
  ["CONTA", "AGOSTO/2026 (31 DIAS UTEIS)", null, null, null, "SETEMBRO/2026 (29 DIAS UTEIS)", null, null, null, "TOTAL (60 DIAS UTEIS)", null, null, null],
  [null, "REMUNERADO", "REALIZADO", "DIFERENCA", "AVR (%)", "REMUNERADO", "REALIZADO", "DIFERENCA", "AVR (%)", "REMUNERADO", "REALIZADO", "DIFERENCA", "AVR (%)"],
  ["001 | ( = ) RECEITA LÍQUIDA", "100,00", "200,00", "100,00", "100,00", "300,00", "400,00", "100,00", "100,00", "400,00", "600,00", "200,00", "100,00"],
  ["021 | ( - ) CUSTOS OPERACIONAIS", "-60,00", "-100,00", "-40,00", "-50,00", "-200,00", "-200,00", "0,00", "-50,00", "-260,00", "-300,00", "-40,00", "-50,00"],
  ["033 |    CUSTO COM PESSOAL", "-50,00", "-80,00", "-30,00", "-40,00", "-100,00", "-120,00", "-20,00", "-30,00", "-150,00", "-200,00", "-50,00", "-33,33"],
  ["036 |       SALÁRIOS E ORDENADOS", "-40,00", "-60,00", "-20,00", "-30,00", "-80,00", "-90,00", "-10,00", "-22,50", "-120,00", "-150,00", "-30,00", "-25,00"],
  ["Linha solta sem código"],
];

describe("parseBrNumber", () => {
  it("lê o formato brasileiro", () => {
    expect(parseBrNumber("423.036,65")).toBe(423036.65);
    expect(parseBrNumber("-8.572,89")).toBe(-8572.89);
    expect(parseBrNumber("0,00")).toBe(0);
    expect(parseBrNumber(null)).toBe(0);
    expect(parseBrNumber(12.5)).toBe(12.5);
  });
});

describe("parseDreGrid", () => {
  const parsed = parseDreGrid(grid);
  it("lê unidade, data oficial e os meses (sem o bloco TOTAL)", () => {
    expect(parsed.unit).toBe("TOTAL CARAMBEI");
    expect(parsed.officialAt).toBe("14/10/2026 07:32");
    expect(parsed.months.map((m) => m.periodKey)).toEqual(["2026-08", "2026-09"]);
    expect(parsed.warnings).toEqual([]);
  });
  it("lê as contas com nível e valores de cada mês", () => {
    const sept = parsed.months[1].lines;
    expect(sept.map((l) => l.code)).toEqual(["001", "021", "033", "036"]);
    expect(sept[0]).toMatchObject({ name: "( = ) RECEITA LÍQUIDA", level: 0, realizado: 400, remunerado: 300 });
    expect(sept[1].level).toBe(0);
    expect(sept[2].level).toBe(1);
    expect(sept[3].level).toBe(2);
    expect(sept[2].avr).toBe(-30);
  });
  it("avisa quando a soma dos meses não bate com o TOTAL", () => {
    const bad = grid.map((r) => [...r]);
    bad[8] = ["001 | ( = ) RECEITA LÍQUIDA", "100,00", "200,00", "100,00", "100,00", "300,00", "400,00", "100,00", "100,00", "400,00", "9.999,00", "200,00", "100,00"];
    expect(parseDreGrid(bad).warnings[0]).toMatch(/não bate/);
  });
  it("arquivo sem cabeçalho devolve aviso e nenhum mês", () => {
    const r = parseDreGrid([["qualquer coisa"]]);
    expect(r.months).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });
});

describe("métricas", () => {
  it("AVR e realizado ÷ remunerado", () => {
    const revenue = { remunerado: 300, realizado: 400 };
    expect(avrPercent({ remunerado: -200, realizado: -200 }, revenue)).toBe(-50);
    expect(ratioPercent({ remunerado: -100, realizado: -120 })).toBe(120);
    expect(avrPercent({ remunerado: 1, realizado: 1 }, { remunerado: 0, realizado: 0 })).toBeNull();
    expect(sumAmounts([{ remunerado: 1, realizado: 2 }, { remunerado: 3, realizado: 4 }])).toEqual({ remunerado: 4, realizado: 6 });
  });
  it("chaves do cascateamento", () => {
    expect(parseDreKey("dre.avr:233")).toEqual({ metric: "avr", ytd: false, code: "233", negate: false });
    expect(parseDreKey("dre.avr.ytd:-021")).toEqual({ metric: "avr", ytd: true, code: "021", negate: true });
    expect(parseDreKey("dre.ratio:033")?.metric).toBe("ratio");
    expect(parseDreKey("dto.month.count")).toBeNull();
  });
});
