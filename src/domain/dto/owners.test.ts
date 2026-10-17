import { describe, it, expect } from "vitest";
import { resolveOwnerNames, type OwnerContext } from "./owners";

const ctx: OwnerContext = {
  collaboratorName: "CLAUDIO ANTUNES DA ROSA",
  leaderName: "BRUNA DE SOUZA PEREIRA",
  evaluatorName: "ELIEL ANTUNES",
  areaLeaders: ["RICARDO ALEXANDRE DE OLIVEIRA"],
  sstPeople: ["TST FULANO"],
  hrPeople: ["ANALISTA RH"],
};

describe("resolveOwnerNames", () => {
  it("colaborador é o próprio avaliado", () => {
    expect(resolveOwnerNames("Colaborador", ctx)).toEqual(["CLAUDIO ANTUNES DA ROSA"]);
  });
  it("liderança: primeiro o líder do DMPeople", () => {
    expect(resolveOwnerNames("Liderança", ctx)).toEqual(["BRUNA DE SOUZA PEREIRA"]);
  });
  it("liderança sem líder na planilha: líder da área; depois quem fez o DTO", () => {
    expect(resolveOwnerNames("Liderança", { ...ctx, leaderName: null })).toEqual(["RICARDO ALEXANDRE DE OLIVEIRA"]);
    expect(resolveOwnerNames("Liderança", { ...ctx, leaderName: null, areaLeaders: [] })).toEqual(["ELIEL ANTUNES"]);
  });
  it("SST e RH usam quem é da função", () => {
    expect(resolveOwnerNames("SST", ctx)).toEqual(["TST FULANO"]);
    expect(resolveOwnerNames("RH", ctx)).toEqual(["ANALISTA RH"]);
  });
  it("manutenção não tem nome fixo", () => {
    expect(resolveOwnerNames("Manutenção", ctx)).toEqual([]);
  });
});
