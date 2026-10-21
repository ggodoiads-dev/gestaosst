/** Números do DRE que viram indicadores: % sobre a receita (AVR) e realizado ÷ remunerado, no mês e no acumulado do ano (YTD). */
export type DreAmounts = { remunerado: number; realizado: number };

/** Soma de um conjunto de meses de uma conta. */
export function sumAmounts(list: DreAmounts[]): DreAmounts {
  return list.reduce((acc, x) => ({ remunerado: acc.remunerado + x.remunerado, realizado: acc.realizado + x.realizado }), { remunerado: 0, realizado: 0 });
}

/** % da conta sobre a receita líquida realizada (o "AVR" do DRE). Sem receita = null. */
export function avrPercent(line: DreAmounts, revenue: DreAmounts): number | null {
  return revenue.realizado === 0 ? null : Math.round((line.realizado / revenue.realizado) * 10000) / 100;
}

/** Realizado ÷ remunerado, em %. Sem remunerado = null. */
export function ratioPercent(line: DreAmounts): number | null {
  return line.remunerado === 0 ? null : Math.round((line.realizado / line.remunerado) * 10000) / 100;
}

/** Chave de indicador do cascateamento ligada ao DRE: `dre.avr:233` (AVR da conta), `dre.avr:-021` (com o sinal trocado, pra
 * custos, que no DRE são negativos) e `dre.ratio:033` (realizado ÷ remunerado). O sufixo `.ytd` pede o acumulado do ano. */
export function parseDreKey(key: string): { metric: "avr" | "ratio"; ytd: boolean; code: string; negate: boolean } | null {
  const m = /^dre\.(avr|ratio)(\.ytd)?:(-?)(\d{3})$/.exec(key);
  if (!m) return null;
  return { metric: m[1] as "avr" | "ratio", ytd: !!m[2], negate: m[3] === "-", code: m[4] };
}
