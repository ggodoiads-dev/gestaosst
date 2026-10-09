import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { classifyAnswer, parseDtoWorkbook, summarizeAnswers } from "./parse";

function workbookBuffer(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const HEADER = [
  "Data", "Colaborador", "Cargo", "Avaliador", "Lider na Inspeção", "QLP", "Empresa", "Cargo Avaliador", "Lider", "Operação", "Atividade",
  "1° - Usa EPI?", "2° - Check list feito?", "3° - Observações",
];

describe("parseDtoWorkbook", () => {
  it("lê as avaliações, guarda só as respostas preenchidas e calcula a conformidade", () => {
    const buf = workbookBuffer([
      HEADER,
      ["2026-08-04", "FLAVIO JOSE DE QUADROS", "AMARRADOR", "ELIEL ANTUNES", null, "T", "LOG 20", "SUPERVISOR", "BRUNA", "VIDROS PR", "AMARRAÇÃO", "SIM", "NÃO", "falar mais com ele"],
      ["2026-07-28", "ISRAEL DE LIMA BARBOZA", "AJUDANTE", "ELIEL ANTUNES", null, "T", "LOG 20", "SUPERVISOR", "BRUNA", "VIDROS PR", "AMARRAÇÃO", "SIM", "SIM", null],
      ["Filtros aplicados: Período", null, null, null, null, null, null, null, null, null, null, null, null, null],
    ]);
    const rows = parseDtoWorkbook(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0].evaluatedName).toBe("FLAVIO JOSE DE QUADROS");
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-08-04");
    expect(rows[0].answers).toHaveLength(3);
    expect(rows[0].yesCount).toBe(1);
    expect(rows[0].noCount).toBe(1);
    expect(rows[0].scorePercent).toBe(50);
    expect(rows[1].scorePercent).toBe(100);
    expect(rows[0].externalKey).not.toBe(rows[1].externalKey);
  });

  it("chave externa é estável (reimportar não duplica)", () => {
    const data = [HEADER, ["2026-08-04", "FULANO", "X", "CICLANO", null, null, null, null, null, null, "AMARRAÇÃO", "SIM", null, null]];
    expect(parseDtoWorkbook(workbookBuffer(data))[0].externalKey).toBe(parseDtoWorkbook(workbookBuffer(data))[0].externalKey);
  });

  it("devolve vazio se não for o export de DTO", () => {
    expect(parseDtoWorkbook(workbookBuffer([["a", "b"], [1, 2]]))).toEqual([]);
  });
});

describe("respostas", () => {
  it("classifica sim/não/n.a. e trata o resto como texto", () => {
    expect(classifyAnswer("SIM")).toBe("yes");
    expect(classifyAnswer("NÃO")).toBe("no");
    expect(classifyAnswer("N/A")).toBe("na");
    expect(classifyAnswer("Uso de segregação")).toBe("text");
  });

  it("sem sim/não não há percentual", () => {
    expect(summarizeAnswers([{ q: "x", a: "N/A" }]).scorePercent).toBeNull();
  });
});
