/**
 * Associação entre duas séries mensais (correlação de Pearson). É descritiva: mostra que duas coisas andam juntas nos meses
 * observados, não que uma causa a outra. Só vale com pelo menos `MIN_PAIRS` meses em que as duas séries têm valor.
 */
export const MIN_PAIRS = 6;

export type CorrelationResult = { r: number; n: number };

export function pearson(a: (number | null)[], b: (number | null)[]): CorrelationResult | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (n < MIN_PAIRS) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100, n };
}

export type CorrelationStrength = "forte" | "moderada" | "fraca";

export function strengthOf(r: number): CorrelationStrength {
  const a = Math.abs(r);
  return a >= 0.7 ? "forte" : a >= 0.4 ? "moderada" : "fraca";
}

/** Frase curta: "forte, andam no mesmo sentido" / "moderada, em sentido oposto" / "fraca (sem relação clara)". */
export function describeCorrelation(r: number): string {
  const s = strengthOf(r);
  if (s === "fraca") return "fraca (sem relação clara)";
  return `${s}, ${r > 0 ? "andam no mesmo sentido" : "em sentido oposto"}`;
}
