/** DPVIM: carga de retorno (≈420 paletes intercalados com chapatex) que precisa ser selecionada e separada em até 48h da chegada. */

export const DPVIM_DEADLINE_HOURS = 48;
export const DPVIM_SOON_HOURS = 12;

export const DPVIM_KINDS = [
  { key: "PALETE", label: "Palete" },
  { key: "CHAPATEX", label: "Chapatex" },
  { key: "QUADRO", label: "Quadro" },
] as const;
export type DpvimKind = (typeof DPVIM_KINDS)[number]["key"];

export function dpvimKindLabel(kind: string): string {
  return DPVIM_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export type DpvimStatus = "ABERTA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

/** Prazo de rebater: 48h a partir da chegada. */
export function dueAtFrom(arrivedAt: Date): Date {
  return new Date(arrivedAt.getTime() + DPVIM_DEADLINE_HOURS * 60 * 60 * 1000);
}

export type DpvimSituation = "ATRASADA" | "VENCE_LOGO" | "NO_PRAZO" | "CONCLUIDA_NO_PRAZO" | "CONCLUIDA_ATRASADA" | "CANCELADA";

export const DPVIM_SITUATION_LABEL: Record<DpvimSituation, string> = {
  ATRASADA: "Atrasada",
  VENCE_LOGO: "Vence em breve",
  NO_PRAZO: "No prazo",
  CONCLUIDA_NO_PRAZO: "Concluída no prazo",
  CONCLUIDA_ATRASADA: "Concluída com atraso",
  CANCELADA: "Cancelada",
};

/** Situação de uma DPVIM frente ao prazo de 48h. `hoursLeft` é negativo quando já passou do prazo (só para as não concluídas). */
export function dpvimSituation(d: { status: DpvimStatus; dueAt: Date; finishedAt: Date | null }, now: Date): { situation: DpvimSituation; hoursLeft: number | null } {
  if (d.status === "CANCELADA") return { situation: "CANCELADA", hoursLeft: null };
  if (d.status === "CONCLUIDA") {
    const late = d.finishedAt !== null && d.finishedAt.getTime() > d.dueAt.getTime();
    return { situation: late ? "CONCLUIDA_ATRASADA" : "CONCLUIDA_NO_PRAZO", hoursLeft: null };
  }
  const hoursLeft = (d.dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursLeft < 0) return { situation: "ATRASADA", hoursLeft };
  return { situation: hoursLeft <= DPVIM_SOON_HOURS ? "VENCE_LOGO" : "NO_PRAZO", hoursLeft };
}

/** "3h 20min" / "1d 4h" / "45min" a partir de horas (valor absoluto). */
export function formatHours(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
  return `${m}min`;
}

/** Interpreta um "AAAA-MM-DDTHH:mm" digitado no horário de Brasília como o instante correto. */
export function parseBrasiliaLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Percentual feito da carga (limitado a 100). */
export function progressPercent(done: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((done / expected) * 100));
}
