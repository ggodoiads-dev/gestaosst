import { describe, expect, it } from "vitest";
import { describeCorrelation, pearson, strengthOf } from "./correlation";

describe("pearson", () => {
  it("série que sobe junto dá 1", () => {
    expect(pearson([1, 2, 3, 4, 5, 6], [2, 4, 6, 8, 10, 12])).toEqual({ r: 1, n: 6 });
  });
  it("série em sentido oposto dá -1", () => {
    expect(pearson([1, 2, 3, 4, 5, 6], [12, 10, 8, 6, 4, 2])?.r).toBe(-1);
  });
  it("ignora meses em que uma das séries não tem valor", () => {
    expect(pearson([1, 2, null, 4, 5, 6, 7], [2, 4, 99, 8, 10, 12, 14])).toEqual({ r: 1, n: 6 });
  });
  it("poucos meses ou série constante não dá resultado", () => {
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeNull();
    expect(pearson([5, 5, 5, 5, 5, 5], [1, 2, 3, 4, 5, 6])).toBeNull();
  });
});

describe("leitura", () => {
  it("classifica a força", () => {
    expect(strengthOf(0.75)).toBe("forte");
    expect(strengthOf(-0.5)).toBe("moderada");
    expect(strengthOf(0.2)).toBe("fraca");
  });
  it("descreve o sentido", () => {
    expect(describeCorrelation(0.8)).toContain("mesmo sentido");
    expect(describeCorrelation(-0.8)).toContain("oposto");
    expect(describeCorrelation(0.1)).toContain("sem relação");
  });
});
