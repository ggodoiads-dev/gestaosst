import { describe, expect, it } from "vitest";
import { parsePercent, parseSurvey, surveyDiagnosis, type MotivosTempo, type Satisfacao } from "./survey";

describe("parsePercent", () => {
  it("fração vira %, e % fica como está", () => {
    expect(parsePercent("0.2922705")).toBe(29.2);
    expect(parsePercent("29,2")).toBe(29.2);
    expect(parsePercent("12%")).toBe(12);
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("abc")).toBeNull();
  });
});

describe("parseSurvey", () => {
  it("motivos por tempo de casa", () => {
    const r = parseSurvey(["TEMPO DE CASA", "0 a 3 Meses", "3 a 6 Meses"], [["MOTIVO", "%", "%"], ["Razões pessoais", "0.29", "0.25"], ["Outros", "0.2", ""], ["", "", ""], ["Filtros aplicados:", "", ""]]);
    expect(r).toMatchObject({ kind: "MOTIVOS_TEMPO" });
    if ("kind" in r && r.kind === "MOTIVOS_TEMPO") {
      expect(r.data.buckets).toEqual(["0 a 3 Meses", "3 a 6 Meses"]);
      expect(r.data.rows).toHaveLength(2);
      expect(r.data.rows[1].values).toEqual([20, null]);
    }
  });
  it("satisfação por categoria, com total separado", () => {
    const r = parseSurvey(["CATEGORIA", "SATISFAÇÃO", "ITENS CRÍTICOS"], [["REMUNERAÇÃO", "0.7772", "0.0833"], ["Total", "0.8", "0.022"], ["", "", ""]]);
    if ("kind" in r && r.kind === "SATISFACAO") {
      expect(r.data.rows).toEqual([{ categoria: "REMUNERAÇÃO", satisfacao: 77.7, criticos: 8.3 }]);
      expect(r.data.total).toEqual({ satisfacao: 80, criticos: 2.2 });
    } else throw new Error("formato errado");
  });
  it("formato desconhecido dá erro claro", () => {
    expect(parseSurvey(["NOME", "DATA"], [])).toHaveProperty("error");
  });
});

describe("surveyDiagnosis", () => {
  const motivos: MotivosTempo = {
    buckets: ["0 a 3 Meses", "6 a 12 Meses"],
    rows: [
      { motivo: "Razões pessoais", values: [29.2, 12] },
      { motivo: "Gestor imediato (problemas com a liderança)", values: [null, 18.8] },
      { motivo: "Papéis e responsabilidades", values: [12.3, null] },
    ],
  };
  const satisfacao: Satisfacao = { rows: [{ categoria: "BENEFÍCIOS", satisfacao: 82.6, criticos: null }, { categoria: "REMUNERAÇÃO", satisfacao: 77.7, criticos: 8.3 }], total: null };
  it("aponta o motivo acionável por faixa e a categoria mais baixa", () => {
    const out = surveyDiagnosis(motivos, satisfacao);
    expect(out.some((l) => l.includes("Gestor imediato") && l.includes("18.8%"))).toBe(true);
    expect(out.some((l) => l.includes("razões pessoais"))).toBe(true);
    expect(out.some((l) => l.includes("remuneração") && l.includes("77.7%"))).toBe(true);
    expect(out.some((l) => l.includes("8.3% dos itens"))).toBe(true);
  });
  it("sem dados, sem frases", () => {
    expect(surveyDiagnosis(null, null)).toEqual([]);
  });
});
