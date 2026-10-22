import { describe, it, expect } from "vitest";
import { computeAtendimentoMinutes, computeTmaMinutes, durationToMinutes, parseTmaSheet, periodKeyFromSheetName, serialToIso } from "./parse";
import { computeTmaStats, formatDuration, parseTmaKey, tmaMetricValue } from "./stats";

describe("abas e datas", () => {
  it("nome da aba vira o mês", () => {
    expect(periodKeyFromSheetName("TMA OUT-26")).toBe("2026-10");
    expect(periodKeyFromSheetName("TMA MAI-26 ")).toBe("2026-05");
    expect(periodKeyFromSheetName("DASH")).toBeNull();
    expect(periodKeyFromSheetName("TMA DEZ-25")).toBe("2025-12");
  });
  it("serial do Excel vira horário de relógio", () => {
    expect(serialToIso(46295.5)).toBe("2026-09-30T12:00");
    expect(serialToIso(46295.8333333)).toBe("2026-09-30T20:00");
    expect(serialToIso(5)).toBeNull();
  });
  it("duração do Excel vira minutos e erro vira null", () => {
    expect(durationToMinutes(0.125)).toBe(180);
    expect(durationToMinutes(-5)).toBeNull();
    expect(durationToMinutes(46239)).toBeNull();
    expect(durationToMinutes("x")).toBeNull();
  });
});

describe("regra do TMA", () => {
  const base = { agendamento: "2026-09-30T20:00", apresentacao: "2026-09-30T19:03", entradaAtendimento: "2026-10-01T09:29", liberacao: "2026-10-01T12:18" };
  it("apresentou no horário ou antes: conta do agendamento até a liberação (TMA Ambev 16:18)", () => {
    expect(computeTmaMinutes(base)).toBe(16 * 60 + 18);
  });
  it("apresentou atrasado: conta da entrada no atendimento", () => {
    expect(computeTmaMinutes({ ...base, agendamento: "2026-09-30T19:00", apresentacao: "2026-09-30T22:30", entradaAtendimento: "2026-10-01T07:45", liberacao: "2026-10-01T11:15" })).toBe(210);
  });
  it("entrou antes do agendamento: conta da entrada", () => {
    expect(computeTmaMinutes({ agendamento: "2026-10-01T20:00", apresentacao: "2026-10-01T14:30", entradaAtendimento: "2026-10-01T15:30", liberacao: "2026-10-01T19:34" })).toBe(244);
  });
  it("tempo de atendimento é sempre entrada → liberação", () => {
    expect(computeAtendimentoMinutes(base)).toBe(2 * 60 + 49);
    expect(computeAtendimentoMinutes({ entradaAtendimento: null, liberacao: "2026-10-01T12:18" })).toBeNull();
  });
});

describe("leitura de uma aba", () => {
  const header = ["DATA DA GRADE", "ARMAZÉM", "TIPO CARRO", "TRANSPORTADORA", "AGENDAMENTO", "APRESENTAÇÃO", "ENTRADA ATENDIMENTO", "CONFERENTE", "LIBERAÇÃO DO VEICULO", "TMA", "STATUS.", "AUX TURNO"];
  const serial = (iso: string) => 25569 + new Date(`${iso}:00Z`).getTime() / 86400000;
  const row = (status: string, ag: string, ap: string, ea: string, lib: string, tma: number) => [serial("2026-09-30T00:00"), status, "SIDER", "TIRIVA", serial(ag), serial(ap), serial(ea), "NIELSON", serial(lib), tma / 1440, "APRESENTADO", "B"];
  const grid = [["x"], header, row("LIBERADO", "2026-09-30T20:00", "2026-09-30T19:03", "2026-10-01T09:29", "2026-10-01T12:18", 16 * 60 + 18), row("LIBERADO", "2026-09-30T19:00", "2026-09-30T22:30", "2026-10-01T07:45", "2026-10-01T11:15", 210), ["", "NÃO APRESENTOU"]];
  const parsed = parseTmaSheet(grid);
  it("acha as colunas pelo nome e lê só as linhas com data e status", () => {
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ status: "LIBERADO", transportadora: "TIRIVA", conferente: "NIELSON", turno: "B", tmaMin: 978, atendimentoMin: 169 });
    expect(parsed.warnings).toEqual([]);
  });
  it("estatísticas: o TMA é o tempo de atendimento; o da Ambev vem à parte", () => {
    const stats = computeTmaStats(parsed.rows);
    expect(stats.loaded).toBe(2);
    expect(stats.avgTma).toBe(Math.round(((169 + 210) / 2) * 100) / 100);
    expect(stats.within3h).toBe(50);
    expect(stats.ambev.avg).toBe((978 + 210) / 2);
    expect(stats.onTime).toBe(50);
    expect(formatDuration(stats.avgTma)).toBe("3:10");
  });
  it("aba sem cabeçalho avisa", () => {
    expect(parseTmaSheet([["qualquer"]]).rows).toEqual([]);
  });
});

describe("chaves do cascateamento", () => {
  it("interpreta as chaves de TMA", () => {
    expect(parseTmaKey("tma.avg")).toEqual({ metric: "avg", ytd: false, stage: null });
    expect(parseTmaKey("tma.within3h.ytd")).toEqual({ metric: "within3h", ytd: true, stage: null });
    expect(parseTmaKey("tma.stage:espera")).toEqual({ metric: "stage", ytd: false, stage: "espera" });
    expect(parseTmaKey("tma.stage")).toBeNull();
    expect(parseTmaKey("dre.avr:233")).toBeNull();
  });
  it("valor da métrica a partir das estatísticas", () => {
    const stats = computeTmaStats([{ status: "LIBERADO", agendamento: null, apresentacao: null, liberacao: "2026-10-01T10:00", tmaMin: 300, atendimentoMin: 120, patioMin: 10, esperaMin: 20, tmcMin: 40, amarracaoMin: 30, liberacaoMin: 15, transportadora: "A", destino: "B", conferente: "C", turno: "A" }]);
    expect(tmaMetricValue(stats, parseTmaKey("tma.avg")!)).toBe(120);
    expect(tmaMetricValue(stats, parseTmaKey("tma.ambev")!)).toBe(300);
    expect(tmaMetricValue(stats, parseTmaKey("tma.stage:amarracao")!)).toBe(30);
    expect(tmaMetricValue(stats, parseTmaKey("tma.tmc")!)).toBe(40);
  });
});
