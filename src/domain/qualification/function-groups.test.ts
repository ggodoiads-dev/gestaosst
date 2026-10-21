import { describe, it, expect } from "vitest";
import { functionGroupRank, groupByFunction, groupByTurno } from "./function-groups";

describe("groupByFunction", () => {
  it("amarradores primeiro, depois operadores, depois o resto e sem função por último", () => {
    const people = [
      { n: "A", f: "Conferente de Carga" },
      { n: "B", f: "Operador de Empilhadeira" },
      { n: "C", f: "Amarrador de carga" },
      { n: "D", f: null },
      { n: "E", f: "Amarrador de carga" },
    ];
    const groups = groupByFunction(people, (p) => p.f);
    expect(groups.map((g) => g.functionName)).toEqual(["Amarrador de carga", "Operador de Empilhadeira", "Conferente de Carga", null]);
    expect(groups[0].entries.map((p) => p.n)).toEqual(["C", "E"]);
  });
  it("rank ignora acento e caixa", () => {
    expect(functionGroupRank("AMARRADOR")).toBe(0);
    expect(functionGroupRank("Operador de Empilhadeira")).toBe(1);
  });
});

describe("groupByTurno", () => {
  it("separa por turno e deixa sem turno por último", () => {
    const people = [
      { n: "A", t: "Turno B" },
      { n: "B", t: null },
      { n: "C", t: "Turno A" },
      { n: "D", t: "Turno A" },
    ];
    const groups = groupByTurno(people, (p) => p.t);
    expect(groups.map((g) => g.turnoName)).toEqual(["Turno A", "Turno B", null]);
    expect(groups[0].entries.map((p) => p.n)).toEqual(["C", "D"]);
  });
});
