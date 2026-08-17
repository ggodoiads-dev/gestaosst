/**
 * Cálculo puro da janela de apuração de descontos de benefício: dia 21 (dois meses antes do
 * mês-alvo) até dia 20 (do mês anterior ao mês-alvo), inclusive — ex: benefício de setembro
 * apura eventos de 21/jul a 20/ago. Esse defasamento dá tempo de processar antes do fechamento
 * da folha do mês-alvo.
 */
export function assessmentWindow(month: number, year: number): { from: Date; toExclusive: Date } {
  const from = new Date(year, month - 3, 21);
  const toExclusive = new Date(year, month - 2, 21);
  return { from, toExclusive };
}

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
