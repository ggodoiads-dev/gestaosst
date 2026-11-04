import { describe, expect, it } from "vitest";
import { adherence, adherenceLevel, matrixStats, parseLevel, type MatrixMemberData } from "./matrix";

describe("aderência e nível", () => {
  it("dominadas (sozinho ou ensina) ÷ avaliadas, como a planilha: 9 de 11 = 81,8%", () => {
    const levels = [4, 3, 3, 3, 2, 3, 4, 3, 3, 2, 3];
    expect(adherence(levels)).toBeCloseTo(9 / 11, 6);
    expect(adherenceLevel(adherence(levels))).toBe("AVANCADO");
  });
  it("célula vazia não entra na conta (COUNTA)", () => {
    expect(adherence([4, 3, undefined, null])).toBe(1);
    expect(adherence([0, 3, undefined])).toBe(0.5); // "não conhece" conta como avaliado
  });
  it("sem nada avaliado, sem aderência nem nível", () => {
    expect(adherence([])).toBeNull();
    expect(adherence([undefined, null])).toBeNull();
    expect(adherenceLevel(null)).toBeNull();
  });
  it("limites: menos de 40% é básico, de 40% a menos de 70% é intermediário", () => {
    expect(adherenceLevel(0.39)).toBe("BASICO");
    expect(adherenceLevel(0.4)).toBe("INTERMEDIARIO");
    expect(adherenceLevel(0.69)).toBe("INTERMEDIARIO");
    expect(adherenceLevel(0.7)).toBe("AVANCADO");
  });
});

describe("matrixStats", () => {
  const members: MatrixMemberData[] = [
    { id: "a", levels: { s1: 4, s2: 3, s3: 1 } },
    { id: "b", levels: { s1: 1, s2: 3 } },
    { id: "c", levels: {} },
  ];
  const r = matrixStats(["s1", "s2", "s3"], members);
  it("por atividade: % dos avaliados que dominam", () => {
    expect(r.bySkill[0]).toMatchObject({ skillId: "s1", rated: 2, value: 0.5 });
    expect(r.bySkill[1].value).toBe(1);
    expect(r.bySkill[2]).toMatchObject({ rated: 1, value: 0 });
  });
  it("por pessoa e média geral só das pessoas avaliadas", () => {
    expect(r.byMember[0].value).toBeCloseTo(2 / 3, 6);
    expect(r.byMember[1].value).toBe(0.5);
    expect(r.byMember[2]).toMatchObject({ value: null, level: null });
    expect(r.average).toBeCloseTo((2 / 3 + 0.5) / 2, 6);
  });
});

describe("parseLevel", () => {
  it("lê com e sem emoji e acento", () => {
    expect(parseLevel("👑 Pode ensinar")).toBe(4);
    expect(parseLevel("⭐ Executa sozinho")).toBe(3);
    expect(parseLevel("🟢 Executa com apoio")).toBe(2);
    expect(parseLevel("🟡 Em desenvolvimento")).toBe(1);
    expect(parseLevel("🔴 Não conhece")).toBe(0);
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("xyz")).toBeNull();
  });
});
