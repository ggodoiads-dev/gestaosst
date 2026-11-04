import { describe, expect, it } from "vitest";
import { namesMatch, uniqueMatch } from "./names";

describe("namesMatch", () => {
  it("nome curto da planilha combina com o nome completo do cadastro", () => {
    expect(namesMatch("Endryk Matheus", "ENDRYK MATHEUS RODRIGUES")).toBe(true);
    expect(namesMatch("Thomas Vieira", "THOMAS VIEIRA KOCH")).toBe(true);
    expect(namesMatch("Antonio Carlos", "ANTONIO CARLOS GARCIA MIRANDA")).toBe(true);
    expect(namesMatch("Flavio José", "FLAVIO JOSE DE QUADROS")).toBe(true);
  });
  it("ignora acento, caixa, espaço sobrando e 'de/da/dos'", () => {
    expect(namesMatch("Joao Jorge ", "JOÃO JORGE")).toBe(true);
    expect(namesMatch("Gileno Diego", "GILENO DIEGO DE MEDEIROS CABRAL")).toBe(true);
  });
  it("não combina pessoas diferentes", () => {
    expect(namesMatch("Carlos Alberto", "CARLOS EDUARDO SILVA")).toBe(false);
    expect(namesMatch("Bryan Vaz", "BRYAN DE LIMA VAZ")).toBe(true); // "de lima" fica de fora; Bryan e Vaz aparecem
    expect(namesMatch("Luiz", "LUIZ FERNANDO")).toBe(false); // nome de uma palavra só combina exato
  });
  it("exige a mesma primeira palavra", () => {
    expect(namesMatch("Alberto Carlos", "CARLOS ALBERTO SILVA")).toBe(false);
  });
});

describe("uniqueMatch", () => {
  const people = [{ id: "1", name: "CARLOS ALBERTO SILVA" }, { id: "2", name: "CARLOS ALBERTO LIMA" }, { id: "3", name: "ANA PAULA SOUZA" }];
  it("devolve o único; ambíguo ou inexistente dá null", () => {
    expect(uniqueMatch("Ana Paula", people)?.id).toBe("3");
    expect(uniqueMatch("Carlos Alberto", people)).toBeNull();
    expect(uniqueMatch("Zé Ninguém", people)).toBeNull();
  });
  it("com mais de um, vale o de nome exatamente igual", () => {
    expect(uniqueMatch("Carlos Alberto Silva", people)?.id).toBe("1");
  });
});
