import { describe, expect, it } from "vitest";
import { buildAbntContent, deltaSentence, joinList } from "./narrative";
import type { MonthlyReport } from "./types";

const report: MonthlyReport = {
  title: "Relatório do Guardian",
  month: "2026-10",
  monthLabel: "Outubro de 2026",
  version: "interno",
  generatedAt: "2026-11-02T12:00:00.000Z",
  generatedBy: "Teste",
  executive: [],
  findings: [
    { severity: "ALTO", module: "Guardian", title: "Adesão abaixo de 70% (65%)", detail: "27 colaboradores sem relato.", recommendation: "Cobrar as lideranças." },
    { severity: "INFO", module: "Acidentes", title: "Sem ocorrências", detail: "Nenhum registro." },
  ],
  sections: [
    {
      key: "g",
      title: "Adesão mês a mês",
      scope: "Colaboradores que relataram ao menos uma vez.",
      kpis: [{ key: "k", label: "Adesão", value: "65%", tone: "bad", delta: "−35 pts vs. mês anterior" }],
      series: [{ title: "Adesão por mês (%)", unit: "%", points: [{ label: "set/26", value: 100 }, { label: "out/26", value: 65 }] }],
      tables: [{ title: "Relatos por tipo", columns: ["Tipo", "Qtde"], rows: [["Condição insegura", 159], ["Comportamento de risco", 42]] }],
      notes: ["Relatos importados até 02/11/2026"],
    },
  ],
  unavailable: [],
};

describe("texto corrido do relatório", () => {
  it("junta listas e reescreve a variação em português corrido", () => {
    expect(joinList(["a", "b", "c"])).toBe("a, b e c");
    expect(deltaSentence("−35 pts vs. mês anterior")).toBe("variação de −35 pts em relação ao mês anterior");
    expect(deltaSentence("= mês anterior")).toBe("valor estável em relação ao mês anterior");
  });

  it("monta as seções numeradas na ordem de um relatório técnico", () => {
    const c = buildAbntContent(report);
    expect(c.sections.map((s) => `${s.number} ${s.title}`)).toEqual([
      "1 INTRODUÇÃO", "2 OBJETIVOS", "3 METODOLOGIA", "4 RESULTADOS", "4.1 Adesão mês a mês", "5 PONTOS CRÍTICOS E DISCUSSÃO", "6 CONCLUSÕES", "7 RECOMENDAÇÕES",
    ]);
    expect(c.resumo).toContain("Outubro de 2026");
  });

  it("descreve só o que está nos dados e numera tabelas e figuras", () => {
    const c = buildAbntContent(report);
    const results = c.sections.find((s) => s.number === "4.1")!;
    const texts = results.blocks.filter((b) => b.type === "p").map((b) => (b as { text: string }).text).join(" ");
    expect(texts).toContain("registrou 65%");
    expect(texts).toContain("A Figura 1");
    expect(texts).toContain("Condição insegura (159)");
    expect(results.blocks.some((b) => b.type === "table" && b.n === 1)).toBe(true);
    expect(results.blocks.some((b) => b.type === "figure" && b.n === 1)).toBe(true);
  });

  it("conclusão reflete os pontos críticos e a IA só entra quando fornecida", () => {
    const without = buildAbntContent(report);
    expect(JSON.stringify(without.sections.find((s) => s.number === "6"))).toContain("1 de nível alto".replace("1 de nível alto", "0 ponto(s) crítico(s) e 1 de nível alto"));
    expect(JSON.stringify(without.sections.find((s) => s.number === "5"))).not.toContain("inteligência artificial");
    const withAi = buildAbntContent(report, { discussao: ["A queda pode refletir importação incompleta."], conclusoes: ["Conclui-se que..."], recomendacoes: ["Importar o Guardian"] });
    expect(JSON.stringify(withAi.sections.find((s) => s.number === "5"))).toContain("inteligência artificial");
    expect(JSON.stringify(withAi.sections.find((s) => s.number === "7"))).toContain("Importar o Guardian.");
  });
});
