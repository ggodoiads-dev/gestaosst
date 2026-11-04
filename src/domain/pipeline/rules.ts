/**
 * Pipeline de Gente: tempo de casa, Ciclo de Gente (faixas de resultado), risco de turnover e Plano de Sucessão. Regras puras, as mesmas da planilha de
 * gestão do pipeline (aba "Pipeline 6.2.1"), com a conta do risco da posição corrigida (a planilha comparava "Até 6 meses" com "Ate 6 meses" e nunca batia).
 */

const fold = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ── Plano de sucessão ──

export const CRITICALITY = [
  { key: "ALTA", label: "Alta" },
  { key: "MEDIA", label: "Média" },
  { key: "BAIXA", label: "Baixa" },
] as const;
export type Criticality = (typeof CRITICALITY)[number]["key"];

export const READINESS = [
  { key: "AGORA", label: "Pronto agora" },
  { key: "ATE_6M", label: "Até 6 meses" },
  { key: "ATE_1A", label: "Até 1 ano" },
  { key: "MAIS_1A", label: "+ 1 ano" },
] as const;
export type Readiness = (typeof READINESS)[number]["key"];

export const POTENTIAL = [
  { key: "ALTO", label: "High Potential" },
  { key: "MEDIO", label: "Potencial médio" },
  { key: "BAIXO", label: "Potencial baixo" },
] as const;
export type Potential = (typeof POTENTIAL)[number]["key"];

export const ORIGIN = [
  { key: "INTERNO", label: "Interno" },
  { key: "EXTERNO", label: "Externo" },
] as const;
export type Origin = (typeof ORIGIN)[number]["key"];

export const POSITION_STATUS = [
  { key: "ANDAMENTO", label: "Em andamento" },
  { key: "AGENDADO", label: "Agendado" },
  { key: "CONCLUIDO", label: "Concluído" },
] as const;
export type PositionStatus = (typeof POSITION_STATUS)[number]["key"];

/** Gaps do sucessor (as competências da lista da planilha). */
export const GAPS = [
  "Conhecimento técnico",
  "Liderança",
  "Comunicação",
  "Visão estratégica",
  "Maturidade",
  "Postura",
  "Indicadores",
  "Autonomia",
  "Planejamento",
  "Relacionamento",
  "Resolução de problemas",
  "Tomada de decisão",
  "Visão Financeira",
  "Gestão de custos",
  "Gestão de resultados",
  "Pensamento analítico",
  "Gestão de conflitos",
  "Engajamento do time",
  "Delegação de tarefas",
  "Organização",
  "Gestão do tempo",
  "Senso de urgência",
  "Inteligência emocional",
  "Estabilidade comportamental",
  "Responsabilidade",
  "Domínio de ferramentas / sistemas",
] as const;

export type PositionRisk = "ALTO" | "MEDIO" | "BAIXO";
export const RISK_LABEL: Record<PositionRisk, string> = { ALTO: "Alto", MEDIO: "Médio", BAIXO: "Baixo" };

/**
 * Risco da posição: cargo de criticidade Alta só fica baixo se há sucessor pronto agora, médio se pronto em até 6 meses e alto em qualquer outro caso
 * (inclusive sem sucessor). Criticidade Média: baixo se pronto agora, senão médio. Criticidade Baixa: baixo.
 */
export function positionRisk(criticality: string | null, readiness: string | null): PositionRisk {
  if (criticality === "ALTA") return readiness === "AGORA" ? "BAIXO" : readiness === "ATE_6M" ? "MEDIO" : "ALTO";
  if (criticality === "MEDIA") return readiness === "AGORA" ? "BAIXO" : "MEDIO";
  return "BAIXO";
}

export type PositionLite = { criticality: string | null; readiness: string | null; potential: string | null; area?: string | null };

export type DistributionRow = { key: string; label: string; count: number; pct: number };

function distribution<K extends string>(items: readonly { key: K; label: string }[], values: (string | null)[], total: number): DistributionRow[] {
  return items.map((it) => {
    const count = values.filter((v) => v === it.key).length;
    return { key: it.key, label: it.label, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
  });
}

/** Resumo do plano: % de cargos por criticidade, potencial dos sucessores, risco da posição e prontidão (sobre o total de cargos). */
export function summarizePositions(positions: PositionLite[]) {
  const total = positions.length;
  return {
    total,
    criticality: distribution(CRITICALITY, positions.map((p) => p.criticality), total),
    potential: distribution(POTENTIAL, positions.map((p) => p.potential), total),
    risk: distribution(
      [
        { key: "ALTO", label: "Alto" },
        { key: "MEDIO", label: "Médio" },
        { key: "BAIXO", label: "Baixo" },
      ] as const,
      positions.map((p) => positionRisk(p.criticality, p.readiness)),
      total,
    ),
    readiness: distribution(READINESS, positions.map((p) => p.readiness), total),
  };
}

// ── Tempo de casa ──

export const TENURE_BANDS = [
  { key: "ATE_6M", label: "< 6 meses" },
  { key: "ATE_1A", label: "< 1 ano" },
  { key: "ATE_2A", label: "> 1 ano" },
  { key: "MAIS_2A", label: "> 2 anos" },
] as const;

/** Faixas da planilha: menos de 6 meses; de 6 a menos de 12; de 12 a menos de 24; 24 ou mais. Média em meses. */
export function tenureSummary(months: number[]) {
  const valid = months.filter((m) => Number.isFinite(m) && m >= 0);
  const total = valid.length;
  const band = (m: number) => (m < 6 ? "ATE_6M" : m < 12 ? "ATE_1A" : m < 24 ? "ATE_2A" : "MAIS_2A");
  const bands = TENURE_BANDS.map((b) => {
    const count = valid.filter((m) => band(m) === b.key).length;
    return { key: b.key, label: b.label, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
  });
  return { total, averageMonths: total > 0 ? Math.round((valid.reduce((s, m) => s + m, 0) / total) * 10) / 10 : null, bands };
}

/** Meses completos entre duas datas (a admissão e o dia de referência). */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

// ── Ciclo de Gente ──

export const ICC_RESULTS = [
  { key: "MUITO_POSITIVA", label: "Muito Positiva" },
  { key: "POSITIVA", label: "Positiva" },
  { key: "SATISFATORIA", label: "Satisfatória" },
  { key: "NEGATIVA", label: "Negativa" },
  { key: "MUITO_NEGATIVA", label: "Muito Negativa" },
  { key: "NAO_INFORMADO", label: "Não Informado" },
] as const;
export type IccResult = (typeof ICC_RESULTS)[number]["key"];

export function iccLabel(key: string | null): string {
  return ICC_RESULTS.find((r) => r.key === key)?.label ?? "Não Informado";
}

/** Colaboradores por faixa de resultado (ICC). Sem resultado informado conta em "Não Informado". */
export function cycleBands(entries: { iccResult: string | null }[]) {
  const total = entries.length;
  return ICC_RESULTS.map((r) => {
    const count = entries.filter((e) => (e.iccResult ?? "NAO_INFORMADO") === r.key).length;
    return { key: r.key, label: r.label, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : null };
  });
}

/** Risco de turnover pelo Ciclo de Gente: resultado de cultura negativo ou muito negativo. */
export const isTurnoverRisk = (entry: { iccResult: string | null }) => entry.iccResult === "NEGATIVA" || entry.iccResult === "MUITO_NEGATIVA";

// ── Leitura de textos da planilha (importação) ──

function pick<K extends string>(items: readonly { key: K; label: string }[], text: string | null | undefined, extra: Record<string, K> = {}): K | null {
  if (!text) return null;
  const t = fold(String(text));
  if (!t) return null;
  if (extra[t]) return extra[t];
  const hit = items.find((i) => fold(i.label) === t || fold(i.key) === t);
  return hit ? hit.key : null;
}

export const parseCriticality = (t: string | null | undefined) => pick(CRITICALITY, t);
export const parseOrigin = (t: string | null | undefined) => pick(ORIGIN, t);
export const parsePositionStatus = (t: string | null | undefined) => pick(POSITION_STATUS, t, { andamento: "ANDAMENTO", agendado: "AGENDADO", concluido: "CONCLUIDO" });
export const parseReadiness = (t: string | null | undefined) => pick(READINESS, t, { "pronto agora": "AGORA", "ate 6 meses": "ATE_6M", "ate 1 ano": "ATE_1A", "+ 1 ano": "MAIS_1A", "mais de 1 ano": "MAIS_1A" });

/** "🚀 High Potential" / "🟡 Potencial Médio" / "🔴 Potencial Baixo", com ou sem o emoji. */
export function parsePotential(t: string | null | undefined): Potential | null {
  if (!t) return null;
  const f = fold(String(t));
  if (f.includes("high") || f.includes("alto")) return "ALTO";
  if (f.includes("medio")) return "MEDIO";
  if (f.includes("baixo")) return "BAIXO";
  return null;
}

export function parseIccResult(t: string | null | undefined): IccResult {
  const f = fold(String(t ?? ""));
  if (!f) return "NAO_INFORMADO";
  if (f.includes("muito") && f.includes("positiv")) return "MUITO_POSITIVA";
  if (f.includes("muito") && f.includes("negativ")) return "MUITO_NEGATIVA";
  if (f.includes("positiv")) return "POSITIVA";
  if (f.includes("negativ")) return "NEGATIVA";
  if (f.includes("satisf")) return "SATISFATORIA";
  return "NAO_INFORMADO";
}

const MONTHS_PT: Record<string, number> = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };

/** Prazo da planilha: uma data ou só o nome do mês ("março", "dezembro"). Devolve a data (último dia do mês, no ano de referência) e o texto original. */
export function parseDue(value: string | Date | null | undefined, referenceYear: number): { date: Date | null; note: string | null } {
  if (value === null || value === undefined || value === "") return { date: null, note: null };
  if (value instanceof Date) return { date: value, note: null };
  const text = String(value).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (br) return { date: new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])), note: null };
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return { date: new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])), note: null };
  const month = MONTHS_PT[fold(text)];
  if (month !== undefined) return { date: new Date(referenceYear, month + 1, 0), note: text };
  return { date: null, note: text };
}
