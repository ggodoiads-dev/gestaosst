import { describe, expect, it } from "vitest";
import { generateLoginEmail, generatePassword, DEFAULT_INITIAL_PASSWORD } from "./credentials";

describe("generateLoginEmail", () => {
  it("gera um e-mail a partir do primeiro nome, removendo acentos", () => {
    expect(generateLoginEmail("João da Silva", new Set())).toBe("joao@log20.com.br");
  });

  it("resolve colisão anexando um número", () => {
    const existing = new Set(["joao@log20.com.br"]);
    expect(generateLoginEmail("João Silva", existing)).toBe("joao2@log20.com.br");
  });

  it("continua incrementando até achar um e-mail livre", () => {
    const existing = new Set(["ana@log20.com.br", "ana2@log20.com.br"]);
    expect(generateLoginEmail("Ana Souza", existing)).toBe("ana3@log20.com.br");
  });
});

describe("DEFAULT_INITIAL_PASSWORD", () => {
  it("é a senha padrão fixa do primeiro acesso", () => {
    expect(DEFAULT_INITIAL_PASSWORD).toBe("12345678");
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
