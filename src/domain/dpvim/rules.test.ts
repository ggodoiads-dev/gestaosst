import { describe, it, expect } from "vitest";
import { buildLines, dpvimBalance, dpvimKindLabel, dpvimSituation, dueAtFrom, formatHours, kindKeyFromLabel, originGroupKey, parseBrasiliaLocal, progressPercent } from "./rules";

const arrived = new Date("2026-11-10T12:00:00Z");

describe("prazo de 48h", () => {
  it("vence 48h depois da chegada", () => {
    expect(dueAtFrom(arrived).toISOString()).toBe("2026-11-12T12:00:00.000Z");
  });
  it("atrasada depois das 48h, vence logo nas últimas 12h, no prazo antes disso", () => {
    const due = dueAtFrom(arrived);
    const base = { status: "ABERTA" as const, dueAt: due, finishedAt: null };
    expect(dpvimSituation(base, new Date("2026-11-12T12:00:01Z")).situation).toBe("ATRASADA");
    expect(dpvimSituation(base, new Date("2026-11-12T00:00:00Z")).situation).toBe("VENCE_LOGO");
    expect(dpvimSituation(base, new Date("2026-11-11T00:00:00Z")).situation).toBe("NO_PRAZO");
    expect(dpvimSituation({ ...base, status: "EM_ANDAMENTO" }, new Date("2026-11-13T12:00:00Z")).hoursLeft).toBe(-24);
  });
  it("concluída: no prazo ou com atraso, pela hora em que acabou", () => {
    const due = dueAtFrom(arrived);
    expect(dpvimSituation({ status: "CONCLUIDA", dueAt: due, finishedAt: new Date("2026-11-12T11:59:00Z") }, new Date()).situation).toBe("CONCLUIDA_NO_PRAZO");
    expect(dpvimSituation({ status: "CONCLUIDA", dueAt: due, finishedAt: new Date("2026-11-12T13:00:00Z") }, new Date()).situation).toBe("CONCLUIDA_ATRASADA");
    expect(dpvimSituation({ status: "CANCELADA", dueAt: due, finishedAt: null }, new Date()).situation).toBe("CANCELADA");
  });
});

describe("formatos", () => {
  it("horas legíveis", () => {
    expect(formatHours(0.75)).toBe("45min");
    expect(formatHours(3.3333)).toBe("3h 20min");
    expect(formatHours(28)).toBe("1d 4h");
    expect(formatHours(-48)).toBe("2d");
  });
  it("data digitada em Brasília", () => {
    expect(parseBrasiliaLocal("2026-11-10T09:00")?.toISOString()).toBe("2026-11-10T12:00:00.000Z");
    expect(parseBrasiliaLocal("10/11/2026")).toBeNull();
  });
  it("progresso limitado a 100", () => {
    expect(progressPercent(210, 420)).toBe(50);
    expect(progressPercent(500, 420)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("divergência da conferência", () => {
  it("saldo = contado - nota: negativo faltou, positivo sobrou", () => {
    expect(dpvimBalance(1900, 2000)).toBe(-100);
    expect(dpvimBalance(2030, 2000)).toBe(30);
    expect(dpvimBalance(2000, 2000)).toBe(0);
  });
  it("agrupa o fornecedor sem se importar com acento, maiúsculas e espaços", () => {
    expect(originGroupKey("  Cervejaria   Ambev ")).toBe(originGroupKey("cervejaria ambev"));
    expect(originGroupKey("Fábrica São José")).toBe("fabrica sao jose");
  });
});

describe("tipos de DPVIM", () => {
  it("chave do tipo cadastrado", () => {
    expect(kindKeyFromLabel("Barril Térmico!")).toBe("c-barril-termico");
    expect(kindKeyFromLabel("!!!")).toBe("");
  });
  it("nome do tipo: usa o cadastrado, depois o de fábrica, senão a própria chave", () => {
    expect(dpvimKindLabel("PALETE")).toBe("Palete");
    expect(dpvimKindLabel("c-barril", [{ key: "c-barril", label: "Barril" }])).toBe("Barril");
    expect(dpvimKindLabel("x")).toBe("x");
  });
});

describe("produtos da DPVIM (linhas)", () => {
  const items = [
    { kind: "PALETE", expectedQty: 120 },
    { kind: "CHAPATEX", expectedQty: 200 },
  ];
  it("saldo por produto: contado pelos ajudantes menos a nota, só depois de concluída", () => {
    const args = { legacyKind: "PALETE", legacyExpected: 0, items, doneByKind: new Map([["PALETE", 110], ["CHAPATEX", 210]]), invoiceByKind: new Map([["PALETE", 120], ["CHAPATEX", 200]]) };
    const done = buildLines({ ...args, concluded: true });
    expect(done.map((l) => l.balance)).toEqual([-10, 10]);
    expect(buildLines({ ...args, concluded: false }).map((l) => l.balance)).toEqual([null, null]);
  });
  it("o norte do conferente não limita: dá para contar mais do que ele", () => {
    const [l] = buildLines({ legacyKind: "X", legacyExpected: 0, items: [{ kind: "PALETE", expectedQty: 100 }], doneByKind: new Map([["PALETE", 130]]), invoiceByKind: null, concluded: true });
    expect(l).toMatchObject({ expected: 100, done: 130, invoice: null, balance: null });
  });
  it("sem a nota (quem não tem acesso) nunca há saldo", () => {
    expect(buildLines({ legacyKind: "PALETE", legacyExpected: 0, items, doneByKind: new Map([["PALETE", 5]]), invoiceByKind: null, concluded: true }).every((l) => l.balance === null)).toBe(true);
  });
  it("DPVIM antiga, sem itens, usa o tipo e a quantidade únicos", () => {
    const lines = buildLines({ legacyKind: "QUADRO", legacyExpected: 420, items: [], doneByKind: new Map([["QUADRO", 400]]), invoiceByKind: new Map([["QUADRO", 420]]), concluded: true });
    expect(lines).toEqual([{ kind: "QUADRO", expected: 420, done: 400, invoice: 420, balance: -20 }]);
  });
  it("tipo que só aparece na contagem ou na nota entra com norte 0", () => {
    const lines = buildLines({ legacyKind: "PALETE", legacyExpected: 0, items: [{ kind: "PALETE", expectedQty: 10 }], doneByKind: new Map([["QUADRO", 7]]), invoiceByKind: new Map([["BARRIL", 3]]), concluded: true });
    expect(lines.map((l) => [l.kind, l.expected, l.done, l.balance])).toEqual([["PALETE", 10, 0, null], ["QUADRO", 0, 7, null], ["BARRIL", 0, 0, -3]]);
  });
});
