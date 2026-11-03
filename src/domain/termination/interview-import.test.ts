import { describe, expect, it } from "vitest";
import { classifyExitReason, classifyExitReasons, parseRating, parseWouldReturn } from "./interview-import";

describe("classifyExitReason", () => {
  it("reconhece o motivo pelo texto livre", () => {
    expect(classifyExitReason("Recebi uma proposta melhor")).toBe("PROPOSTA");
    expect(classifyExitReason("Salário baixo")).toBe("SALARIO");
    expect(classifyExitReason("Problema com o supervisor")).toBe("LIDERANCA");
    expect(classifyExitReason("Escala 6x1 muito cansativa")).toBe("CARGA_ESCALA");
    expect(classifyExitReason("Motivo de saúde na família")).toBe("SAUDE_PESSOAL");
    expect(classifyExitReason("Mora longe, muito deslocamento")).toBe("DISTANCIA");
  });
  it("vários motivos no mesmo texto", () => {
    expect(classifyExitReasons("Salário baixo e problema com o gestor")).toEqual(["SALARIO", "LIDERANCA"]);
  });
  it("sem palavra conhecida é Outro; sem texto, nada", () => {
    expect(classifyExitReason("Queria mudar de ramo")).toBe("OUTRO");
    expect(classifyExitReason("")).toBeNull();
    expect(classifyExitReason(null)).toBeNull();
  });
});

describe("respostas", () => {
  it("voltaria", () => {
    expect(parseWouldReturn("Sim")).toBe("SIM");
    expect(parseWouldReturn("Não")).toBe("NAO");
    expect(parseWouldReturn("Talvez")).toBe("TALVEZ");
    expect(parseWouldReturn("")).toBeNull();
  });
  it("notas de 1 a 5", () => {
    expect(parseRating("4")).toBe(4);
    expect(parseRating("3,5")).toBe(4);
    expect(parseRating("5/5")).toBe(5);
    expect(parseRating("0")).toBeNull();
    expect(parseRating("nota 9")).toBeNull();
    expect(parseRating("")).toBeNull();
  });
});
