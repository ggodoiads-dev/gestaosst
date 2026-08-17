import { describe, it, expect } from "vitest";
import { assessmentWindow, daysInMonth } from "./benefit-calendar";

describe("assessmentWindow", () => {
  it("setembro apura de 21/jul a 20/ago", () => {
    const { from, toExclusive } = assessmentWindow(9, 2026);
    expect(from).toEqual(new Date(2026, 6, 21));
    expect(toExclusive).toEqual(new Date(2026, 7, 21));
  });

  it("janeiro apura de 21/nov a 20/dez do ano anterior", () => {
    const { from, toExclusive } = assessmentWindow(1, 2026);
    expect(from).toEqual(new Date(2025, 10, 21));
    expect(toExclusive).toEqual(new Date(2025, 11, 21));
  });

  it("fevereiro apura de 21/dez do ano anterior a 20/jan do ano-alvo", () => {
    const { from, toExclusive } = assessmentWindow(2, 2026);
    expect(from).toEqual(new Date(2025, 11, 21));
    expect(toExclusive).toEqual(new Date(2026, 0, 21));
  });

  it("a janela cobre exatamente os dias 21 a 20 (30 ou 31 dias, sem sobra)", () => {
    const { from, toExclusive } = assessmentWindow(9, 2026);
    const diffDays = Math.round((toExclusive.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(31); // 21/jul a 20/ago = 31 dias (julho tem 31 dias)
  });
});

describe("daysInMonth", () => {
  it("calcula corretamente meses de 28, 30 e 31 dias", () => {
    expect(daysInMonth(2, 2026)).toBe(28); // fevereiro, não-bissexto
    expect(daysInMonth(2, 2024)).toBe(29); // fevereiro, bissexto
    expect(daysInMonth(4, 2026)).toBe(30);
    expect(daysInMonth(1, 2026)).toBe(31);
  });
});
