import { describe, expect, it } from "vitest";
import { TURNOVER_IC_SEED_KEY, platformMotiveIvs, platformSatisfactionExtraIvs, turnoverDimensionIv, turnoverStaticIvs } from "./turnover-cascade";
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
    const ctx = { monthRate: 10, ytdRate: 10, exits: [], satisfaction: { byCategory: new Map(), total: null }, platformMotives: new Map() };
    for (const iv of ivs.filter((i) => i.sigoKey)) expect(turnoverMetric(iv.sigoKey!, ctx)).not.toBeUndefined();
    expect(ivs.find((i) => i.seedKey === "iv:to:motivo:BENEFICIOS")?.description).toContain("Pergunte o por quê");
    expect(ivs.find((i) => i.seedKey === "iv:to:nota:beneficios")?.parentSeedKey).toBe("iv:to:motivo:BENEFICIOS");
  });
  it("a entrevista fica dentro dos pedidos de demissão e os motivos por pessoa dentro dela", () => {
    expect(ivs.find((i) => i.seedKey === "iv:to:entrevista")?.parentSeedKey).toBe("iv:to:demissao");
    expect(ivs.find((i) => i.seedKey === "iv:to:motivo:SALARIO")?.parentSeedKey).toBe("iv:to:entrevista");
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

describe("IVs a partir das tabelas da plataforma", () => {
  const motivos = {
    buckets: ["0 a 3 Meses", "6 a 12 Meses"],
    rows: [
      { motivo: "Gestor imediato (problemas com a liderança)", values: [null, 18.8] },
      { motivo: "Razões pessoais", values: [29.2, 12] },
      { motivo: "Vazio", values: [null, null] },
    ],
  };
  const ivs = platformMotiveIvs(motivos);
  it("um IV por motivo com valor e um por faixa preenchida; motivo sem nenhum valor fica de fora", () => {
    expect(ivs.map((i) => i.seedKey)).toEqual([
      "iv:to:pm:gestorimediatoproblemascomalideranca",
      "iv:to:pm:gestorimediatoproblemascomalideranca:6a12meses",
      "iv:to:pm:razoespessoais",
      "iv:to:pm:razoespessoais:0a3meses",
      "iv:to:pm:razoespessoais:6a12meses",
    ]);
    expect(ivs[1].parentSeedKey).toBe(ivs[0].seedKey);
    expect(ivs[0].parentSeedKey).toBe("iv:to:demissao");
    expect(ivs[1].sigoKey).toBe("turnover.platform.motive:gestorimediatoproblemascomalideranca~6a12meses");
    expect(ivs[0].description).toContain("6 a 12 Meses: 18,8%");
    expect(ivs[0].description).toContain("Pergunte o por quê"); // liderança casa com as perguntas de liderança
  });
  it("categoria de satisfação nova vira IV; as conhecidas não duplicam", () => {
    const extra = platformSatisfactionExtraIvs({ rows: [{ categoria: "REMUNERAÇÃO", satisfacao: 77, criticos: null }, { categoria: "SEGURANÇA", satisfacao: 90, criticos: 1 }], total: null });
    expect(extra.map((i) => i.seedKey)).toEqual(["iv:to:plat:seguranca"]);
    expect(extra[0].sigoKey).toBe("turnover.platform.sat:seguranca");
  });
});
