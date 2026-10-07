/** Utilidades de "mês de referência" (chave `YYYY-MM`) usadas nas telas com navegação mês a mês. */

/** Mês corrente no fuso de Brasília. */
export function currentMonthKey(now = new Date()): string {
  const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthShortLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return `${label.replace(".", "")}/${String(y).slice(2)}`;
}

/** Primeiro e último instante do mês em horário local do servidor — o último dia é cortado em "hoje"
 * quando o mês ainda está em andamento (nada de dia futuro contando como falta). */
export function monthRangeUntilToday(month: string, now = new Date()): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const lastDay = new Date(y, m, 0, 23, 59, 59, 999);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to: lastDay < endOfToday ? lastDay : endOfToday };
}
