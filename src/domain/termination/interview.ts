/** Entrevista de desligamento: motivos, notas e a síntese que alimenta o PDCA do turnover. Regras puras. */

export const EXIT_REASONS = [
  { key: "SALARIO", label: "Salário" },
  { key: "BENEFICIOS", label: "Benefícios" },
  { key: "LIDERANCA", label: "Relação com a liderança" },
  { key: "CLIMA", label: "Clima e relacionamento na equipe" },
  { key: "CARGA_ESCALA", label: "Carga de trabalho ou escala" },
  { key: "CRESCIMENTO", label: "Falta de crescimento" },
  { key: "PROPOSTA", label: "Proposta melhor em outra empresa" },
  { key: "DISTANCIA", label: "Distância ou transporte" },
  { key: "SAUDE_PESSOAL", label: "Saúde, família ou motivo pessoal" },
  { key: "ADAPTACAO", label: "Não se adaptou à função" },
  { key: "OUTRO", label: "Outro" },
] as const;

export type ExitReasonKey = (typeof EXIT_REASONS)[number]["key"];

export const exitReasonLabel = (key: string) => EXIT_REASONS.find((r) => r.key === key)?.label ?? key;
export const isExitReason = (key: unknown): key is ExitReasonKey => EXIT_REASONS.some((r) => r.key === key);

export const EXIT_RATINGS = [
  { key: "lideranca", label: "Liderança" },
  { key: "salario", label: "Salário" },
  { key: "beneficios", label: "Benefícios" },
  { key: "ambiente", label: "Ambiente de trabalho" },
  { key: "treinamento", label: "Treinamento e integração" },
] as const;

export type ExitRatingKey = (typeof EXIT_RATINGS)[number]["key"];
export type ExitRatings = Partial<Record<ExitRatingKey, number>>;

export const WOULD_RETURN = [
  { key: "SIM", label: "Voltaria" },
  { key: "TALVEZ", label: "Talvez voltasse" },
  { key: "NAO", label: "Não voltaria" },
] as const;
export type WouldReturn = (typeof WOULD_RETURN)[number]["key"];

/** Notas de 1 a 5; o que não for isso é descartado. */
export function sanitizeRatings(value: unknown): ExitRatings {
  const out: ExitRatings = {};
  if (!value || typeof value !== "object") return out;
  for (const r of EXIT_RATINGS) {
    const n = (value as Record<string, unknown>)[r.key];
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5) out[r.key] = n;
  }
  return out;
}

export type InterviewLite = { primaryReason: string; secondaryReasons: string[]; ratings: ExitRatings; wouldReturn: string | null };

export type InterviewSummary = {
  count: number;
  /** Motivo principal mais citado primeiro. */
  primary: { key: string; label: string; count: number; pct: number }[];
  /** Quantas vezes cada motivo apareceu (principal ou secundário). */
  mentions: { key: string; label: string; count: number }[];
  ratings: { key: ExitRatingKey; label: string; avg: number | null; n: number }[];
  wouldReturnPct: number | null;
};

export function summarizeInterviews(list: InterviewLite[]): InterviewSummary {
  const primary = new Map<string, number>();
  const mentions = new Map<string, number>();
  for (const i of list) {
    primary.set(i.primaryReason, (primary.get(i.primaryReason) ?? 0) + 1);
    for (const k of new Set([i.primaryReason, ...i.secondaryReasons])) mentions.set(k, (mentions.get(k) ?? 0) + 1);
  }
  const answered = list.filter((i) => i.wouldReturn);
  return {
    count: list.length,
    primary: [...primary.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: exitReasonLabel(key), count, pct: Math.round((count / list.length) * 100) })),
    mentions: [...mentions.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: exitReasonLabel(key), count })),
    ratings: EXIT_RATINGS.map((r) => {
      const values = list.map((i) => i.ratings[r.key]).filter((n): n is number => typeof n === "number");
      return { key: r.key, label: r.label, avg: values.length ? Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 10) / 10 : null, n: values.length };
    }),
    wouldReturnPct: answered.length ? Math.round((answered.filter((i) => i.wouldReturn === "SIM").length / answered.length) * 100) : null,
  };
}

/** Frases para o diagnóstico do PDCA, vindas das entrevistas. `voluntaryExits` = saídas voluntárias da janela (a cobertura mede quantas foram entrevistadas). */
export function interviewDiagnosis(s: InterviewSummary, voluntaryExits: number): string[] {
  const out: string[] = [];
  if (voluntaryExits > 0) {
    const coverage = Math.round((Math.min(s.count, voluntaryExits) / voluntaryExits) * 100);
    if (coverage < 70) out.push(`Só ${coverage}% dos pedidos de demissão da janela têm entrevista de desligamento (${s.count} de ${voluntaryExits}): sem isso o PDCA trabalha com hipótese, não com causa informada.`);
  }
  if (s.count < 5) return out;
  const top = s.primary[0];
  if (top && top.pct >= 30) out.push(`Nas entrevistas, o motivo principal mais citado é "${top.label}" (${top.pct}% dos entrevistados).`);
  const lowest = s.ratings.filter((r) => r.avg !== null && r.n >= 5).sort((a, b) => (a.avg ?? 5) - (b.avg ?? 5))[0];
  if (lowest && (lowest.avg ?? 5) <= 3) out.push(`O item pior avaliado pelos que saíram é ${lowest.label.toLowerCase()} (nota média ${lowest.avg} de 5).`);
  if (s.wouldReturnPct !== null && s.wouldReturnPct < 40) out.push(`Só ${s.wouldReturnPct}% dos entrevistados voltariam a trabalhar na operação.`);
  return out;
}
