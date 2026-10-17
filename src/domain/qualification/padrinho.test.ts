import { describe, it, expect } from "vitest";
import { isPadrinhoQualification, PADRINHO_TYPE_NAME } from "./padrinho";

describe("isPadrinhoQualification", () => {
  it("reconhece o tipo padrão e variações", () => {
    expect(isPadrinhoQualification(PADRINHO_TYPE_NAME)).toBe(true);
    expect(isPadrinhoQualification("PADRINHO")).toBe(true);
    expect(isPadrinhoQualification("Trilha de Treinamento para Padrinhos")).toBe(true);
  });
  it("não confunde com outras qualificações", () => {
    expect(isPadrinhoQualification("NR-11 Operador de Empilhadeira")).toBe(false);
    expect(isPadrinhoQualification("ASO Periódico")).toBe(false);
  });
});
