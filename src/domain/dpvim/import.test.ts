import { describe, it, expect } from "vitest";
import { detectImportColumns, groupImportRows, importReference, materialToKind, parseSheetDate, parseSheetQty, splitSupplier, vimFromReference } from "./import";

const HEADERS = ["Dias em aberto", "NF", "VIM ", "Empresa/fornecedor", "Cód ATG", "Material", "Quantidade", "Data", "Comentários", "Erro", "Familia"];

describe("colunas da planilha", () => {
  it("acha as colunas pelo nome, mesmo com acento e espaço sobrando", () => {
    const r = detectImportColumns(HEADERS);
    expect(r).toEqual({ ok: true, cols: { vim: 2, nf: 1, supplier: 3, material: 5, qty: 6, date: 7, comment: 8 } });
  });
  it("diz o que faltou", () => {
    const r = detectImportColumns(["NF", "Material"]);
    expect(r).toEqual({ ok: false, missing: ["VIM", "Empresa/fornecedor", "Quantidade", "Data"] });
  });
});

describe("fornecedor, material, data e quantidade", () => {
  it("separa nome e unidade do 'S.A.F.'", () => {
    expect(splitSupplier("Ambev S.A.F.Santa Catarina")).toEqual({ name: "Ambev", unit: "Santa Catarina" });
    expect(splitSupplier("Ambev S.A.F.Ag. Claras do Sul")).toEqual({ name: "Ambev", unit: "Ag. Claras do Sul" });
    expect(splitSupplier("Ambev S.A.F.Jaguariúna")).toEqual({ name: "Ambev", unit: "Jaguariúna" });
    expect(splitSupplier("Heineken")).toEqual({ name: "Heineken", unit: null });
  });
  it("material vira tipo", () => {
    expect(materialToKind("Pallet")).toBe("PALETE");
    expect(materialToKind("Chapatex")).toBe("CHAPATEX");
    expect(materialToKind(" QUADRO ")).toBe("QUADRO");
    expect(materialToKind("Barril")).toBeNull();
    expect(materialToKind("Barril", [{ key: "c-barril", label: "Barril" }])).toBe("c-barril");
  });
  it("data e quantidade", () => {
    expect(parseSheetDate("17/11/2026")).toBe("2026-11-17");
    expect(parseSheetDate("31/02/2026")).toBeNull();
    expect(parseSheetDate("2026-11-17")).toBeNull();
    expect(parseSheetQty("7040")).toBe(7040);
    expect(parseSheetQty("7.040")).toBe(7040);
    expect(parseSheetQty("0")).toBeNull();
    expect(parseSheetQty("abc")).toBeNull();
  });
});

describe("agrupar por VIM", () => {
  const cols = { vim: 2, nf: 1, supplier: 3, material: 5, qty: 6, date: 7, comment: 8 };
  const row = (nf: string, vim: string, sup: string, mat: string, qty: string, date: string, c = "OD") => ["19", nf, vim, sup, "38779", mat, qty, date, c, "", ""];
  it("uma VIM com vários materiais e duas NFs vira uma DPVIM só", () => {
    const g = groupImportRows(
      [
        row("484332-1", "7165940", "Ambev S.A.F.Jacareí", "Chapatex", "1600", "17/11/2026"),
        row("484332-1", "7165940", "Ambev S.A.F.Jacareí", "Quadro", "480", "17/11/2026"),
        row("484322-1", "7165940", "Ambev S.A.F.Jacareí", "Pallet", "24", "17/11/2026"),
      ],
      cols,
    );
    expect(g).toHaveLength(1);
    expect(g[0].nfs).toEqual(["484332-1", "484322-1"]);
    expect(g[0].items).toEqual([
      { material: "Chapatex", qty: 1600 },
      { material: "Quadro", qty: 480 },
      { material: "Pallet", qty: 24 },
    ]);
    expect(g[0].arrivedDay).toBe("2026-11-17");
    expect(g[0].errors).toEqual([]);
  });
  it("soma o mesmo material de NFs diferentes e ignora linhas sem VIM (rodapé)", () => {
    const g = groupImportRows(
      [
        row("1-1", "700", "Ambev S.A.F.Jacareí", "Pallet", "10", "01/11/2026"),
        row("2-1", "700", "Ambev S.A.F.Jacareí", "pallet", "5", "01/11/2026"),
        ["46344", "", "", "", "", "", "", "", "", "", ""],
      ],
      cols,
    );
    expect(g).toHaveLength(1);
    expect(g[0].items).toEqual([{ material: "Pallet", qty: 15 }]);
  });
  it("aponta erro: fornecedor ou data diferente na mesma VIM, quantidade inválida", () => {
    const g = groupImportRows(
      [
        row("1-1", "700", "Ambev S.A.F.Jacareí", "Pallet", "10", "01/11/2026"),
        row("1-1", "700", "Ambev S.A.F.Uberlândia", "Quadro", "x", "02/11/2026"),
      ],
      cols,
    );
    expect(g[0].errors).toHaveLength(3);
  });
});

describe("referência da VIM", () => {
  it("guarda e reconhece o número da VIM", () => {
    expect(importReference("7018780", ["454592-1"])).toBe("VIM 7018780 · NF 454592-1");
    expect(importReference("7165940", ["484332-1", "484322-1"])).toBe("VIM 7165940 · NF 484332-1, 484322-1");
    expect(vimFromReference("VIM 7018780 · NF 454592-1")).toBe("7018780");
    expect(vimFromReference("ABC-123")).toBeNull();
    expect(vimFromReference(null)).toBeNull();
  });
});
