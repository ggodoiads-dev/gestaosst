import { describe, expect, it } from "vitest";
import { classifyTermination, headcountAt, tenureBucket, tenureDays, terminationKey, turnoverRate } from "./rules";

describe("classifyTermination", () => {
  it("pedido de demissão é voluntário", () => {
    expect(classifyTermination(null, "Pedido de demissão")).toBe("VOLUNTARIO");
    expect(classifyTermination("Voluntário", null)).toBe("VOLUNTARIO");
  });
  it("involuntário não é confundido com voluntário", () => {
    expect(classifyTermination("Involuntário", null)).toBe("INVOLUNTARIO");
  });
  it("dispensa, justa causa e fim de contrato são da empresa", () => {
    expect(classifyTermination(null, "Dispensa sem justa causa")).toBe("INVOLUNTARIO");
    expect(classifyTermination(null, "Justa causa")).toBe("INVOLUNTARIO");
    expect(classifyTermination(null, "Término de contrato de experiência")).toBe("INVOLUNTARIO");
  });
  it("acordo e outros", () => {
    expect(classifyTermination(null, "Acordo (art. 484-A)")).toBe("ACORDO");
    expect(classifyTermination(null, "Aposentadoria")).toBe("OUTRO");
  });
  it("sem pista clara não classifica", () => {
    expect(classifyTermination(null, null)).toBe("NAO_CLASSIFICADO");
    expect(classifyTermination(null, "Motivos pessoais")).toBe("NAO_CLASSIFICADO");
  });
});

describe("terminationKey", () => {
  it("usa matrícula quando há e ignora acento e caixa no nome", () => {
    const d = new Date(2026, 9, 15, 12);
    expect(terminationKey("123", "João", d)).toBe("m:123|2026-10-15");
    expect(terminationKey(null, "João  da Silva", d)).toBe(terminationKey("", "JOAO DA SILVA", d));
  });
});

describe("tempo de casa", () => {
  it("conta dias e faixa", () => {
    const adm = new Date(2026, 0, 1, 12);
    expect(tenureDays(adm, new Date(2026, 0, 31, 12))).toBe(30);
    expect(tenureBucket(30)).toBe("ATE_90");
    expect(tenureBucket(120)).toBe("91_180");
    expect(tenureBucket(300)).toBe("181_365");
    expect(tenureBucket(500)).toBe("MAIS_1_ANO");
    expect(tenureBucket(null)).toBe("SEM_DATA");
    expect(tenureDays(null, adm)).toBeNull();
  });
});

describe("turnover", () => {
  it("efetivo em uma data", () => {
    const people = [
      { admissionDate: new Date(2025, 0, 1), inactivatedAt: null },
      { admissionDate: new Date(2025, 0, 1), inactivatedAt: new Date(2026, 2, 1) },
      { admissionDate: new Date(2026, 5, 1), inactivatedAt: null },
      { admissionDate: null, inactivatedAt: null },
    ];
    expect(headcountAt(people, new Date(2026, 1, 1))).toBe(3);
    expect(headcountAt(people, new Date(2026, 6, 1))).toBe(3);
  });
  it("taxa sobre a média do efetivo", () => {
    expect(turnoverRate(5, 95, 105)).toBe(5);
    expect(turnoverRate(2, 0, 0)).toBeNull();
  });
});
