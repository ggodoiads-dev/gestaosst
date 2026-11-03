import { describe, expect, it } from "vitest";
import { filterNavGroups, isOptInHref, isPathAllowed, owningHref, withOptInNav } from "./nav-access";

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

describe("abas extras do Auditor (Escalas, só leitura)", () => {
  const groups = [{ key: "rh", title: "RH", items: [{ href: "/presenca", label: "Presença", icon: "x" }] }, { key: "geral", title: "Geral", items: [{ href: "/inicio", label: "Início", icon: "x" }] }];

  it("Escalas só entra no menu quando está marcada", () => {
    expect(withOptInNav(groups, new Set(["/presenca"])).flatMap((g) => g.items.map((i) => i.href))).not.toContain("/escalas");
    const withEscalas = withOptInNav(groups, new Set(["/presenca", "/escalas"]));
    expect(withEscalas.find((g) => g.key === "rh")?.items.map((i) => i.href)).toEqual(["/presenca", "/escalas"]);
  });
  it("sem grupo RH, cria um; e não duplica se já existe", () => {
    const sem = [{ key: "geral", title: "Geral", items: [{ href: "/inicio", label: "Início", icon: "x" }] }];
    expect(withOptInNav(sem, new Set(["/escalas"])).some((g) => g.key === "rh")).toBe(true);
    const ja = [{ key: "rh", title: "RH", items: [{ href: "/escalas", label: "Escalas", icon: "x" }] }];
    expect(withOptInNav(ja, new Set(["/escalas"])).flatMap((g) => g.items).length).toBe(1);
  });
  it("só /escalas é opt-in", () => {
    expect(isOptInHref("/escalas")).toBe(true);
    expect(isOptInHref("/presenca")).toBe(false);
  });
  it("a aba extra abre pelo endereço só quando marcada", () => {
    const known = ["/inicio", "/escalas"];
    expect(isPathAllowed("/escalas", new Set(["/escalas"]), known)).toBe(true);
    expect(isPathAllowed("/escalas", new Set(["/inicio"]), known)).toBe(false);
  });
});
