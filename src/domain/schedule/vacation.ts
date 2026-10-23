/** Férias em dias CORRIDOS: o primeiro dia mais N-1 dias seguidos, contando sábado, domingo e feriado. Datas como "AAAA-MM-DD". */

export const VACATION_MAX_DAYS = 60;

const DAY_MS = 86400000;
const toUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDaysToKey(key: string, days: number): string {
  return toKey(toUtc(key) + days * DAY_MS);
}

/** Todos os dias das férias, do primeiro ao último. */
export function vacationDayKeys(startKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDaysToKey(startKey, i));
}

/** Último dia de férias e o dia em que a pessoa volta ao trabalho. */
export function vacationRange(startKey: string, days: number): { endKey: string; returnKey: string } {
  return { endKey: addDaysToKey(startKey, days - 1), returnKey: addDaysToKey(startKey, days) };
}

export function isValidVacation(startKey: string, days: number): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(startKey) && !Number.isNaN(toUtc(startKey)) && Number.isInteger(days) && days >= 1 && days <= VACATION_MAX_DAYS;
}

/** A partir de um dia, até onde vai a sequência seguida de dias de férias (`vacationKeys` = todos os dias de férias da pessoa). */
export function contiguousEnd(fromKey: string, vacationKeys: Set<string>): string {
  let end = fromKey;
  while (vacationKeys.has(addDaysToKey(end, 1))) end = addDaysToKey(end, 1);
  return end;
}

/** O começo da sequência que contém `fromKey`. */
export function contiguousStart(fromKey: string, vacationKeys: Set<string>): string {
  let start = fromKey;
  while (vacationKeys.has(addDaysToKey(start, -1))) start = addDaysToKey(start, -1);
  return start;
}
