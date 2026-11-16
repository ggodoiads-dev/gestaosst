/** Feriados nacionais do Brasil (os que dão direito a folga compensatória no banco de horas). Corpus Christi e Carnaval são ponto facultativo, não entram. */

export type Holiday = { date: string; name: string };

/** Domingo de Páscoa (algoritmo gregoriano anônimo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nationalHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const goodFriday = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  return [
    { date: key(year, 1, 1), name: "Confraternização Universal" },
    { date: goodFriday.toISOString().slice(0, 10), name: "Sexta-feira Santa" },
    { date: key(year, 4, 21), name: "Tiradentes" },
    { date: key(year, 5, 1), name: "Dia do Trabalho" },
    { date: key(year, 9, 7), name: "Independência do Brasil" },
    { date: key(year, 10, 12), name: "Nossa Senhora Aparecida" },
    { date: key(year, 11, 2), name: "Finados" },
    { date: key(year, 11, 15), name: "Proclamação da República" },
    // Feriado nacional desde 2024 (Lei 14.759/2023).
    ...(year >= 2024 ? [{ date: key(year, 11, 20), name: "Consciência Negra" }] : []),
    { date: key(year, 12, 25), name: "Natal" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayOn(dateKey: string): Holiday | null {
  const year = Number(dateKey.slice(0, 4));
  return Number.isFinite(year) ? (nationalHolidays(year).find((h) => h.date === dateKey) ?? null) : null;
}
