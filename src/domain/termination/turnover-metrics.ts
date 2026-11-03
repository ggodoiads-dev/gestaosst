/**
 * Indicadores do turnover que alimentam os IVs do cascateamento (IC "TO geral"). Tudo calculado sobre as saídas da janela de 12 meses fechados
 * que contam no turnover. Regras puras: o serviço só busca os dados e entrega aqui.
 */
import type { ExitRatings } from "./interview";
import type { TerminationKind } from "./rules";

export type WindowExit = {
  kind: TerminationKind;
  /** Dias de casa na saída; null sem data de admissão. */
  tenureDays: number | null;
  turno: string | null;
  area: string | null;
  cargo: string | null;
  interview: { primaryReason: string; ratings: ExitRatings; wouldReturn: string | null } | null;
};

export type TurnoverContext = {
  /** Turnover dos 12 meses (%), ou null quando a janela não tem histórico completo. */
  rate: number | null;
  exits: WindowExit[];
  /** Satisfação da plataforma de entrevistas, por categoria (chave = surveyKey da categoria) e o total. */
  satisfaction: { byCategory: Map<string, { satisfacao: number | null; criticos: number | null }>; total: { satisfacao: number | null; criticos: number | null } | null };
};

export const surveyKey = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pct = (part: number, total: number) => (total === 0 ? null : Math.round((part / total) * 10000) / 100);

/** Chave do SIGO → valor. Chaves: turnover.rolling12, .exits12, .voluntary.pct, .early90.pct, .interviews.coverage, .wouldreturn.pct, .motive:KEY,
 * .rating:KEY, .turno:NOME, .area:NOME, .cargo:NOME, .platform.sat:CATEGORIA (ou "total"), .platform.crit:CATEGORIA. NOME vem com encodeURIComponent. */
export function turnoverMetric(key: string, ctx: TurnoverContext): number | null {
  const [base, rawParam] = key.split(":");
  const param = rawParam === undefined ? undefined : decodeURIComponent(rawParam);
  const exits = ctx.exits;
  const interviews = exits.filter((e) => e.interview);

  switch (base) {
    case "turnover.rolling12":
    case "turnover.rolling12.ytd":
      return ctx.rate;
    case "turnover.exits12":
      return ctx.rate === null ? null : exits.length;
    case "turnover.voluntary.pct":
      return pct(exits.filter((e) => e.kind === "VOLUNTARIO").length, exits.length);
    case "turnover.early90.pct": {
      const known = exits.filter((e) => e.tenureDays !== null);
      return pct(known.filter((e) => (e.tenureDays as number) <= 90).length, known.length);
    }
    case "turnover.interviews.coverage": {
      const voluntary = exits.filter((e) => e.kind === "VOLUNTARIO");
      return pct(voluntary.filter((e) => e.interview).length, voluntary.length);
    }
    case "turnover.wouldreturn.pct": {
      const answered = interviews.filter((e) => e.interview!.wouldReturn);
      return pct(answered.filter((e) => e.interview!.wouldReturn === "SIM").length, answered.length);
    }
    case "turnover.motive":
      return param ? pct(interviews.filter((e) => e.interview!.primaryReason === param).length, interviews.length) : null;
    case "turnover.rating": {
      const values = interviews.map((e) => (e.interview!.ratings as Record<string, number | undefined>)[param ?? ""]).filter((n): n is number => typeof n === "number");
      return values.length ? Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 100) / 100 : null;
    }
    case "turnover.turno":
      return exits.length ? pct(exits.filter((e) => e.turno === param).length, exits.length) : null;
    case "turnover.area":
      return exits.length ? pct(exits.filter((e) => e.area === param).length, exits.length) : null;
    case "turnover.cargo":
      return exits.length ? pct(exits.filter((e) => e.cargo === param).length, exits.length) : null;
    case "turnover.platform.sat":
      return param === "total" ? (ctx.satisfaction.total?.satisfacao ?? null) : (ctx.satisfaction.byCategory.get(param ?? "")?.satisfacao ?? null);
    case "turnover.platform.crit":
      return param === "total" ? (ctx.satisfaction.total?.criticos ?? null) : (ctx.satisfaction.byCategory.get(param ?? "")?.criticos ?? null);
    default:
      return null;
  }
}

/** Mês (AAAA-MM) em que a janela de 12 meses fechados termina para o período pedido: o próprio mês se já fechou; senão o último fechado. Null no futuro. */
export function windowEndFor(periodKey: string, currentKey: string): string | null {
  if (periodKey > currentKey) return null;
  if (periodKey < currentKey) return periodKey;
  const [y, m] = currentKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const isTurnoverKey = (key: string) => key.startsWith("turnover.");
