/**
 * Cálculo determinístico do status de escala (trabalho/folga) de um colaborador
 * num dia qualquer, a partir do tipo de escala (ciclo de dias trabalhados +
 * dias de folga) e da data de início do ciclo — sem depender de persistência
 * (mesma filosofia do `rule-engine.ts` do checklist).
 */

export type ScheduleDayComputedStatus = "TRABALHO" | "FOLGA";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Retorna se `date` é dia de trabalho ou folga, dado um ciclo de `workDays`
 * dias trabalhados seguidos de `restDays` dias de folga, começando em
 * `startDate` (dia 1 do ciclo = trabalho). Funciona também para datas
 * anteriores a `startDate`, projetando o ciclo para trás.
 */
export function getDayStatus(
  date: Date,
  startDate: Date,
  workDays: number,
  restDays: number,
): ScheduleDayComputedStatus {
  const cycleLength = workDays + restDays;
  if (cycleLength <= 0) return "FOLGA";

  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(startDate).getTime()) / MS_PER_DAY);
  const position = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  return position < workDays ? "TRABALHO" : "FOLGA";
}
