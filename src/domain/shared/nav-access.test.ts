import { describe, expect, it } from "vitest";
import { filterNavGroups, isPathAllowed, owningHref } from "./nav-access";

const KNOWN = ["/inicio", "/financeiro", "/financeiro/dre", "/equipamentos", "/acidentes", "/acidentes/importar", "/tma"];

describe("acesso por abas", () => {
  const allowed = new Set(["/financeiro", "/equipamentos"]);

  it("libera a aba marcada e as telas dentro dela", () => {
    expect(isPathAllowed("/equipamentos", allowed, KNOWN)).toBe(true);
    expect(isPathAllowed("/equipamentos/abc-123", allowed, KNOWN)).toBe(true);
    expect(isPathAllowed("/financeiro", allowed, KNOWN)).toBe(true);
  });

  it("não deixa entrar numa aba que tem item próprio e não foi marcada (DRE dentro de Financeiro)", () => {
    expect(owningHref("/financeiro/dre", KNOWN)).toBe("/financeiro/dre");
    expect(isPathAllowed("/financeiro/dre", allowed, KNOWN)).toBe(false);
    expect(isPathAllowed("/acidentes/importar", new Set(["/acidentes"]), KNOWN)).toBe(false);
  });

  it("bloqueia o que não foi marcado ou não pertence a nenhuma aba", () => {
    expect(isPathAllowed("/tma", allowed, KNOWN)).toBe(false);
    expect(isPathAllowed("/usuarios", allowed, KNOWN)).toBe(false);
    expect(isPathAllowed("/equipamentosX", allowed, KNOWN)).toBe(false);
  });

  it("início e termos de uso são sempre liberados", () => {
    expect(isPathAllowed("/inicio", new Set(), KNOWN)).toBe(true);
    expect(isPathAllowed("/termos-de-uso", new Set(), KNOWN)).toBe(true);
  });

  it("filtra o menu e some com grupo vazio", () => {
    const groups = [
      { key: "geral", items: [{ href: "/inicio" }, { href: "/rico" }] },
      { key: "fin", items: [{ href: "/financeiro" }, { href: "/financeiro/dre" }] },
      { key: "outro", items: [{ href: "/tma" }] },
    ];
    const result = filterNavGroups(groups, new Set(["/financeiro"]));
    expect(result.map((g) => g.key)).toEqual(["geral", "fin"]);
    expect(result[0].items.map((i) => i.href)).toEqual(["/inicio"]);
    expect(result[1].items.map((i) => i.href)).toEqual(["/financeiro"]);
  });
});
