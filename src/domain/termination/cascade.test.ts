import { describe, expect, it } from "vitest";
import { buildCascade, cascadeProgress, childrenOf, depthOf, descendantIds, orphanCauses, type CascadeInput } from "./cascade";
import type { PdcaCause } from "./pdca";

const base: CascadeInput = {
  total: 20,
  kinds: [{ label: "Pedido de demissão", count: 14 }, { label: "Iniciativa da empresa", count: 6 }],
  motives: [{ key: "BENEFICIOS", label: "Benefícios", count: 5, pct: 38 }, { key: "SALARIO", label: "Salário", count: 3, pct: 23 }],
  interviewCount: 13,
  ratings: [{ key: "beneficios", label: "Benefícios", avg: 2.8, n: 12 }, { key: "salario", label: "Salário", avg: null, n: 0 }],
  wouldReturnPct: 40,
  tenure: [{ label: "Até 90 dias", count: 9 }, { label: "91 a 180 dias", count: 0 }],
  areas: [{ label: "Expedição", count: 8 }, { label: "Pátio", count: 1 }],
  turnos: [{ label: "Noite", count: 6 }],
  cargos: [],
  survey: {
    motivos: { buckets: ["0 a 3 Meses", "3 a 6 Meses"], rows: [{ motivo: "Gestor imediato", values: [null, 18.8] }, { motivo: "Vazio", values: [null, null] }] },
    satisfacao: { rows: [{ categoria: "REMUNERAÇÃO", satisfacao: 77.7, criticos: 8.3 }, { categoria: "BENEFÍCIOS", satisfacao: 82.6, criticos: null }], total: null },
    motivosPeriod: "Jan a Out/2026",
    satisfacaoPeriod: null,
  },
};

describe("buildCascade", () => {
  const groups = buildCascade(base);
  const byId = (id: string) => groups.find((g) => g.id === id)!;

  it("monta os cinco grupos quando há dado", () => {
    expect(groups.map((g) => g.id)).toEqual(["forma", "motivo", "tempo", "onde", "plataforma"]);
  });
  it("ramo de motivo carrega a nota e a satisfação da plataforma como fatos", () => {
    const ben = byId("motivo").branches.find((b) => b.id === "a:motivo:BENEFICIOS")!;
    expect(ben.pct).toBe(38);
    expect(ben.of).toBe("dos entrevistados");
    expect(ben.facts.some((f) => f.includes("2,8 de 5"))).toBe(true);
    expect(ben.prompts.length).toBeGreaterThan(0);
  });
  it("tempo de casa ignora faixa sem saída e calcula o percentual das saídas", () => {
    expect(byId("tempo").branches).toHaveLength(1);
    expect(byId("tempo").branches[0]).toMatchObject({ label: "Até 90 dias", pct: 45 });
  });
  it("onde só traz concentração de 2 ou mais saídas", () => {
    expect(byId("onde").branches.map((b) => b.label)).toEqual(["Área: Expedição", "Turno: Noite"]);
  });
  it("plataforma: motivo com pico, descarta linha vazia, e satisfação da menor para a maior", () => {
    const labels = byId("plataforma").branches.map((b) => b.label);
    expect(labels).toEqual(["Gestor imediato", "Satisfação: REMUNERAÇÃO", "Satisfação: BENEFÍCIOS"]);
    expect(byId("plataforma").note).toContain("Jan a Out/2026");
  });
  it("sem dados, sem grupos", () => {
    expect(buildCascade({ ...base, kinds: [], motives: [], tenure: [], areas: [], turnos: [], cargos: [], survey: { motivos: null, satisfacao: null, motivosPeriod: null, satisfacaoPeriod: null } })).toEqual([]);
  });
});

describe("árvore de causas", () => {
  const causes: PdcaCause[] = [
    { id: "c1", text: "Benefício fraco", evidence: "", parentId: "a:motivo:BENEFICIOS" },
    { id: "c2", text: "Plano de saúde só após 90 dias", evidence: "", parentId: "c1" },
    { id: "c3", text: "Regra do contrato", evidence: "", parentId: "c2", root: true },
    { id: "c4", text: "Causa solta (formato antigo)", evidence: "" },
    { id: "c5", text: "Ramo que sumiu", evidence: "", parentId: "a:area:antiga" },
  ];
  it("filhos, profundidade e descendentes", () => {
    expect(childrenOf(causes, "c1").map((c) => c.id)).toEqual(["c2"]);
    expect(depthOf(causes, "c1")).toBe(1);
    expect(depthOf(causes, "c3")).toBe(3);
    expect([...descendantIds(causes, "c1")].sort()).toEqual(["c1", "c2", "c3"]);
  });
  it("órfãs: sem pai ou com ramo que não existe mais", () => {
    const branchIds = new Set(["a:motivo:BENEFICIOS"]);
    expect(orphanCauses(causes, branchIds).map((c) => c.id)).toEqual(["c4", "c5"]);
  });
  it("progresso: ramos investigados e causa raiz sem ação", () => {
    const groups = buildCascade(base);
    const p = cascadeProgress(groups, causes, new Set());
    expect(p.investigated).toBe(1);
    expect(p.rootCauses).toBe(1);
    expect(p.rootsWithoutAction).toBe(1);
    expect(cascadeProgress(groups, causes, new Set(["c3"])).rootsWithoutAction).toBe(0);
  });
});
