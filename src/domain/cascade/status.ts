/**
 * Regras puras do cascateamento: IC (item de controle — O QUE, o resultado) e IV (item de verificação — COMO, o processo
 * que fecha o IC). O status de cada nó compara o resultado com a meta; o diagnóstico cruza o status do IC com o dos seus IVs.
 */
export type CascadeKind = "SONHO" | "PILAR" | "IC" | "IV";
export type CascadeUnit = "PERCENT" | "NUMBER" | "MINUTES" | "DAYS" | "MONEY";
export type CascadePolarity = "HIGHER" | "LOWER";
/** NONE = meta fixa; YEAR = meta anual (conta proporcional ao mês do resultado); MONTH = meta do mês (proporcional aos dias). */
export type CascadePace = "NONE" | "YEAR" | "MONTH";
export type NodeStatus = "OK" | "FAIL" | "NO_DATA" | "NO_TARGET";

export const UNIT_LABELS: Record<CascadeUnit, string> = {
  PERCENT: "Percentual (%)",
  NUMBER: "Número",
  MINUTES: "Minutos",
  DAYS: "Dias",
  MONEY: "Reais (R$)",
};

const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isValidPeriodKey(key: string): boolean {
  const m = MONTH_RE.exec(key);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Meta esperada até agora: anual proporcional ao mês (set = 9/12), mensal proporcional aos dias do mês corrente. */
export function expectedTarget(args: { target: number; polarity: CascadePolarity; pace: CascadePace; periodKey: string; todayKey: string }): number {
  const { target, polarity, pace, periodKey, todayKey } = args;
  if (polarity === "LOWER" || pace === "NONE") return target;
  const m = MONTH_RE.exec(periodKey);
  if (!m) return target;
  if (pace === "YEAR") return (target * Number(m[2])) / 12;
  // MONTH: só o mês corrente é proporcional; mês fechado cobra a meta cheia.
  if (todayKey.slice(0, 7) !== periodKey) return target;
  const day = Number(todayKey.slice(8, 10));
  const daysInMonth = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return (target * day) / daysInMonth;
}

export function evaluateNode(args: {
  value: number | null;
  target: number | null;
  polarity: CascadePolarity;
  pace: CascadePace;
  periodKey: string;
  todayKey: string;
}): { status: NodeStatus; expected: number | null; progress: number | null } {
  if (args.target === null) return { status: args.value === null ? "NO_DATA" : "NO_TARGET", expected: null, progress: null };
  if (args.value === null) return { status: "NO_DATA", expected: args.target, progress: null };
  const expected = expectedTarget({ ...args, target: args.target });
  const ok = args.polarity === "HIGHER" ? args.value >= expected : args.value <= expected;
  let progress: number;
  if (args.polarity === "HIGHER") progress = expected === 0 ? 1 : args.value / expected;
  else progress = args.value === 0 ? 1 : expected / args.value;
  return { status: ok ? "OK" : "FAIL", expected, progress: Math.max(0, Math.min(progress, 1)) };
}

export type IvRollup = "ALL_OK" | "SOME_FAIL" | "NO_DATA" | "NONE";

/** Resume os IVs de um IC: qualquer vermelho = SOME_FAIL; sem nenhum IV com meta e dado = NO_DATA; sem IV nenhum = NONE. */
export function rollupIvs(statuses: NodeStatus[]): IvRollup {
  if (statuses.length === 0) return "NONE";
  if (statuses.includes("FAIL")) return "SOME_FAIL";
  if (statuses.includes("OK")) return "ALL_OK";
  return "NO_DATA";
}

export type Diagnosis = { tone: "success" | "warning" | "danger" | "neutral"; title: string; text: string };

/** Cruza o resultado (IC) com o processo (IVs): onde está o problema — na execução da rotina ou no desenho dela. */
export function diagnose(icStatus: NodeStatus, ivs: IvRollup): Diagnosis {
  if (ivs === "NONE") {
    return { tone: "neutral", title: "Sem desdobramento", text: "Esta meta ainda não tem IVs. Abra o COMO: o que a rotina precisa fazer para fechar o resultado." };
  }
  if (icStatus === "NO_DATA" || icStatus === "NO_TARGET") {
    return { tone: "neutral", title: "Sem resultado", text: "Falta a meta ou o resultado do IC para cruzar com os IVs." };
  }
  if (icStatus === "FAIL" && ivs === "ALL_OK") {
    return { tone: "warning", title: "Rotina em dia, resultado fora", text: "Os IVs estão cumpridos e o IC não fechou: o processo desenhado pode não estar gerando o resultado. Revise os IVs." };
  }
  if (icStatus === "FAIL" && ivs === "SOME_FAIL") {
    return { tone: "danger", title: "Rotina falhando", text: "O IC não fechou e há IVs fora da meta: o foco é a execução dos IVs vermelhos." };
  }
  if (icStatus === "OK" && ivs === "SOME_FAIL") {
    return { tone: "warning", title: "Resultado vindo, rotina não sustenta", text: "O IC fechou, mas há IVs fora da meta: risco de o resultado cair adiante." };
  }
  if (icStatus === "OK") return { tone: "success", title: "Em dia", text: "Resultado e rotina dentro da meta." };
  return { tone: "neutral", title: "Sem dados nos IVs", text: "Os IVs ainda não têm resultado para comparar." };
}

export function formatCascadeValue(unit: CascadeUnit, value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  switch (unit) {
    case "PERCENT":
      return `${text}%`;
    case "MINUTES": {
      const total = Math.round(value);
      if (total < 60) return `${total} min`;
      return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
    }
    case "DAYS":
      return `${text} dia(s)`;
    case "MONEY":
      return `R$ ${rounded.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:
      return text;
  }
}
