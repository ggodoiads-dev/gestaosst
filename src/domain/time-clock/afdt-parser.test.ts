import { describe, expect, it } from "vitest";
import { parseAfdt } from "./afdt-parser";

const HEADER =
  "0000000011113631347000184000000000000LOG20 LOGISTICA SA                                                                                                                                    0108202610082026150820261036";
const MARK_ORIGINAL_ENTRADA = "000000002201082026074991213084490100047008350000406E01O";
const MARK_ORIGINAL_SAIDA = "000000003201082026130291213084490100047008350000406S01O";
const MARK_MANUAL_SEM_PONTO = "000000018207082026065991213084490100000000000000000E01ISEM PONTO";
const MARK_MANUAL_CORRECAO = "000000023208082026114491213084490100000000000000000S01ICorreção de ponto";
const TRAILER = "0000014699";

describe("parseAfdt", () => {
  it("ignora cabeçalho (tipo 1) e rodapé (tipo 9)", () => {
    const { marks, ignoredLines } = parseAfdt([HEADER, TRAILER].join("\n"));
    expect(marks).toHaveLength(0);
    expect(ignoredLines).toBe(0);
  });

  it("decodifica uma marcação original de entrada", () => {
    const { marks } = parseAfdt(MARK_ORIGINAL_ENTRADA);
    expect(marks).toHaveLength(1);
    const [mark] = marks;
    expect(mark.nsr).toBe(2);
    expect(mark.pis).toBe("91213084490");
    expect(mark.markType).toBe("ENTRADA");
    expect(mark.markNumber).toBe(1);
    expect(mark.origin).toBe("ORIGINAL");
    expect(mark.reason).toBeNull();
    // 01/08/2026 07:49 em América/São_Paulo (UTC-3) = 10:49 UTC
    expect(mark.timestamp.toISOString()).toBe("2026-08-01T10:49:00.000Z");
  });

  it("decodifica uma marcação original de saída", () => {
    const { marks } = parseAfdt(MARK_ORIGINAL_SAIDA);
    expect(marks[0].markType).toBe("SAIDA");
    expect(marks[0].markNumber).toBe(1);
    expect(marks[0].origin).toBe("ORIGINAL");
  });

  it("decodifica uma marcação manual sem motivo explícito de horário previsto (\"SEM PONTO\")", () => {
    const { marks } = parseAfdt(MARK_MANUAL_SEM_PONTO);
    const [mark] = marks;
    expect(mark.origin).toBe("MANUAL");
    expect(mark.reason).toBe("SEM PONTO");
  });

  it("decodifica uma marcação manual com motivo \"Correção de ponto\"", () => {
    const { marks } = parseAfdt(MARK_MANUAL_CORRECAO);
    const [mark] = marks;
    expect(mark.origin).toBe("MANUAL");
    expect(mark.reason).toBe("Correção de ponto");
    expect(mark.markType).toBe("SAIDA");
  });

  it("processa um arquivo completo com cabeçalho, marcações e rodapé, ignorando o que não é marcação", () => {
    const file = [HEADER, MARK_ORIGINAL_ENTRADA, MARK_ORIGINAL_SAIDA, MARK_MANUAL_SEM_PONTO, TRAILER].join("\n");
    const { marks, ignoredLines } = parseAfdt(file);
    expect(marks).toHaveLength(3);
    expect(ignoredLines).toBe(0);
  });

  it("lida com BOM UTF-8 no início do arquivo", () => {
    const file = "﻿" + MARK_ORIGINAL_ENTRADA;
    const { marks } = parseAfdt(file);
    expect(marks).toHaveLength(1);
    expect(marks[0].pis).toBe("91213084490");
  });

  it("conta como ignorada uma linha de marcação curta demais pra ter os campos obrigatórios", () => {
    const shortMarkLine = "0".repeat(9) + "2" + "0".repeat(10); // tipo "2" na posição certa, mas só 20 chars
    const { marks, ignoredLines } = parseAfdt(shortMarkLine);
    expect(marks).toHaveLength(0);
    expect(ignoredLines).toBe(1);
  });
});
