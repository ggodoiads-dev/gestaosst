import { describe, expect, it } from "vitest";
import { buildHeadline, buildPainelBriefing, buildPainelHeadline } from "./headline";

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
    expect(text(buildHeadline({ alertCount: 0, criticalCount: 0, checklistPct: null, turnover: { rate: 13.1, goal: null } }))).toContain("em 13,1%");
  });
});

describe("buildPainelHeadline", () => {
  it("sem aviso, operação em ordem", () => {
    expect(text(buildPainelHeadline({ alertCount: 0, criticalCount: 0 }))).toBe("Operação em ordem: nenhum aviso disparado hoje.");
  });
  it("pontos e críticos, no singular e no plural", () => {
    expect(text(buildPainelHeadline({ alertCount: 2, criticalCount: 1 }))).toBe("2 pontos pedem a sua atenção hoje, e 1 é crítico: comece por ele.");
    expect(text(buildPainelHeadline({ alertCount: 1, criticalCount: 0 }))).toBe("1 ponto pede a sua atenção hoje, nenhum crítico.");
    expect(text(buildPainelHeadline({ alertCount: 5, criticalCount: 3 }))).toBe("5 pontos pedem a sua atenção hoje, e 3 são críticos: comece por eles.");
  });
});

describe("buildPainelBriefing", () => {
  it("compara checklist e Guardian com o mesmo ponto do mês passado e o turnover com a meta", () => {
    const p = buildPainelBriefing({
      checklist: { pct: 72, sameDay: { cut: "03/out", prev: 27 } },
      guardian: { pct: 30, sameDay: { cut: "04/out", prev: 100 } },
      turnover: { rate: 26.3, goal: 14.07 },
    });
    expect(text(p)).toBe("A aderência de checklist está em 72%: até 03/out do mês passado estava em 27%, +45 pts. A adesão ao Guardian está em 30%: até 04/out do mês passado estava em 100%, −70 pts. O turnover do ano está acima da meta, em 26,3% contra 14,07%.");
    expect(p.filter((x) => x.mark === "mint").map((x) => x.text)).toContain("+45 pts");
    expect(p.filter((x) => x.mark === "rose").map((x) => x.text)).toEqual(expect.arrayContaining(["30%", "−70 pts", "acima da meta"]));
  });
  it("sem comparação, só o número; sem dado, a frase some", () => {
    expect(text(buildPainelBriefing({ checklist: { pct: 92 }, guardian: null, turnover: null }))).toBe("A aderência de checklist está em 92%.");
    expect(buildPainelBriefing({ checklist: null, guardian: null, turnover: null })).toEqual([]);
  });
  it("turnover sem meta mostra o valor", () => {
    expect(text(buildPainelBriefing({ checklist: null, guardian: null, turnover: { rate: 26.32, goal: null } }))).toBe("O turnover do ano está em 26,3%.");
  });
});
