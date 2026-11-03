import { describe, expect, it } from "vitest";
import { buildHeadline } from "./headline";

const text = (p: ReturnType<typeof buildHeadline>) => p.map((x) => x.text).join("");

describe("buildHeadline", () => {
  it("sem aviso e sem números, só diz que está em ordem", () => {
    expect(text(buildHeadline({ alertCount: 0, criticalCount: 0, checklistPct: null, turnover: null }))).toBe("Tudo em ordem hoje: nenhum aviso disparado.");
  });
  it("conta os pontos e destaca os críticos", () => {
    const p = buildHeadline({ alertCount: 4, criticalCount: 2, checklistPct: null, turnover: null });
    expect(text(p)).toBe("Hoje a operação tem 4 pontos pedindo você, 2 críticos.");
    expect(p.find((x) => x.mark === "rose")?.text).toBe("2 críticos");
  });
  it("singular", () => {
    expect(text(buildHeadline({ alertCount: 1, criticalCount: 1, checklistPct: null, turnover: null }))).toBe("Hoje a operação tem 1 ponto pedindo você, 1 crítico.");
  });
  it("junta checklist e turnover em uma frase só", () => {
    const p = buildHeadline({ alertCount: 2, criticalCount: 0, checklistPct: 92, turnover: { rate: 13.1, goal: 13.92 } });
    expect(text(p)).toBe("Hoje a operação tem 2 pontos pedindo você. A aderência de checklist está em 92% e o turnover está dentro da meta.");
  });
  it("turnover acima da meta fica em vermelho; checklist baixo também", () => {
    const p = buildHeadline({ alertCount: 0, criticalCount: 0, checklistPct: 70, turnover: { rate: 15, goal: 14 } });
    expect(p.filter((x) => x.mark === "rose").map((x) => x.text)).toEqual(["70%", "acima da meta"]);
  });
  it("turnover sem meta mostra o valor", () => {
    expect(text(buildHeadline({ alertCount: 0, criticalCount: 0, checklistPct: null, turnover: { rate: 13.1, goal: null } }))).toContain("em 13.1%");
  });
});
