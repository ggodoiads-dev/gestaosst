import { describe, expect, it } from "vitest";
import { generateLoginEmail, generatePassword } from "./credentials";

describe("generateLoginEmail", () => {
  it("gera um e-mail a partir do nome, removendo acentos", () => {
    expect(generateLoginEmail("João da Silva", new Set())).toBe("joao.da.silva@log20.local");
  });

  it("resolve colisão anexando um número", () => {
    const existing = new Set(["joao.silva@log20.local"]);
    expect(generateLoginEmail("João Silva", existing)).toBe("joao.silva2@log20.local");
  });

  it("continua incrementando até achar um e-mail livre", () => {
    const existing = new Set(["ana.souza@log20.local", "ana.souza2@log20.local"]);
    expect(generateLoginEmail("Ana Souza", existing)).toBe("ana.souza3@log20.local");
  });
});

describe("generatePassword", () => {
  it("gera senha com o tamanho pedido", () => {
    expect(generatePassword(8)).toHaveLength(8);
    expect(generatePassword(12)).toHaveLength(12);
  });

  it("não usa caracteres ambíguos (0/O, 1/l/I)", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword(20);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });
});
