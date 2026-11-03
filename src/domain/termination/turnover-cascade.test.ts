import { describe, expect, it } from "vitest";
import { TURNOVER_IC_SEED_KEY, turnoverDimensionIv, turnoverStaticIvs } from "./turnover-cascade";
import { turnoverMetric } from "./turnover-metrics";

describe("turnoverStaticIvs", () => {
  const ivs = turnoverStaticIvs();
  it("seedKeys únicos e todo pai existe (o IC ou outro IV da lista)", () => {
    const keys = ivs.map((i) => i.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
    const known = new Set([TURNOVER_IC_SEED_KEY, ...keys]);
    for (const iv of ivs) expect(known.has(iv.parentSeedKey)).toBe(true);
  });
  it("o pai vem antes do filho (a criação segue a ordem da lista)", () => {
    const seen = new Set([TURNOVER_IC_SEED_KEY]);
    for (const iv of ivs) {
      expect(seen.has(iv.parentSeedKey)).toBe(true);
      seen.add(iv.seedKey);
    }
  });
  it("cada sigoKey é reconhecida pelo cálculo (não devolve undefined e não cai em chave desconhecida sem querer)", () => {
    const ctx = { rate: 10, exits: [], satisfaction: { byCategory: new Map(), total: null } };
    for (const iv of ivs.filter((i) => i.sigoKey)) expect(turnoverMetric(iv.sigoKey!, ctx)).not.toBeUndefined();
    expect(ivs.find((i) => i.seedKey === "iv:to:motivo:BENEFICIOS")?.description).toContain("Pergunte o por quê");
    expect(ivs.find((i) => i.seedKey === "iv:to:nota:beneficios")?.parentSeedKey).toBe("iv:to:motivo:BENEFICIOS");
  });
});

describe("turnoverDimensionIv", () => {
  it("monta o IV de um turno com chave de leitura codificada", () => {
    const iv = turnoverDimensionIv("turno", "Noite A/B");
    expect(iv.parentSeedKey).toBe("iv:to:turno");
    expect(iv.sigoKey).toBe(`turnover.turno:${encodeURIComponent("Noite A/B")}`);
    expect(iv.seedKey).toBe("iv:to:turno:noite-a-b");
  });
});
