/** Saldo de banco de horas em DIAS de folga: créditos (feriado trabalhado, BH+, ajuste manual +) menos o que foi compensado (BH-, ajuste manual -). Negativo = devendo. */

export type BankEntry = { date: string; days: number };
export type BankNote = { date: string; status: "BH_MAIS" | "BH_MENOS" };

export type BankBalance = { credits: number; debits: number; balance: number };

/** Um BH+ lançado na escala num dia que já tem lançamento no banco (ex.: o crédito do feriado) não conta de novo. */
export function computeBalance(entries: BankEntry[], notes: BankNote[]): BankBalance {
  const entryDates = new Set(entries.map((e) => e.date));
  let credits = 0;
  let debits = 0;
  for (const e of entries) {
    if (e.days >= 0) credits += e.days;
    else debits += -e.days;
  }
  for (const n of notes) {
    if (n.status === "BH_MAIS") {
      if (!entryDates.has(n.date)) credits += 1;
    } else debits += 1;
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  return { credits: round(credits), debits: round(debits), balance: round(credits - debits) };
}
