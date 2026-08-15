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

/**
 * Status de um colaborador num dia, já resolvendo de onde vem a data de início do ciclo:
 * a data pessoal (`scheduleStartDate`, calculada a partir do 1º dia de folga informado no
 * cadastro) quando definida, senão a data compartilhada do turno — substitui o padrão repetido
 * em vários serviços (`collaborator.turno ? getDayStatus(...) : "FOLGA"`).
 */
export function getCollaboratorDayStatus(
  date: Date,
  collaborator: {
    scheduleStartDate?: Date | null;
    turno: { startDate: Date; scheduleType: { workDays: number; restDays: number } } | null;
  },
): ScheduleDayComputedStatus {
  if (!collaborator.turno) return "FOLGA";
  const anchor = collaborator.scheduleStartDate ?? collaborator.turno.startDate;
  return getDayStatus(date, anchor, collaborator.turno.scheduleType.workDays, collaborator.turno.scheduleType.restDays);
}

/**
 * A partir do primeiro dia de folga informado pelo usuário (mais fácil de saber de cabeça do
 * que uma abstrata "data de início do ciclo"), calcula a data equivalente de início do ciclo
 * (dia 1 = trabalho), pra cadastro de escala por colaborador.
 */
export function cycleStartFromFirstRestDay(firstRestDate: Date, workDays: number): Date {
  const start = startOfDay(firstRestDate);
  start.setDate(start.getDate() - workDays);
  start.setHours(12, 0, 0, 0);
  return start;
}

/**
 * Confere se o segundo dia de folga informado é consistente com o primeiro, dado o ciclo —
 * dia seguinte quando há 2+ dias de folga seguidos, ou o mesmo dia de folga no próximo ciclo
 * quando só há 1 (ex: 6x1). Serve só de conferência pro operador não digitar datas erradas.
 */
export function isSecondRestDayConsistent(
  firstRestDate: Date,
  secondRestDate: Date,
  workDays: number,
  restDays: number,
): boolean {
  const cycleLength = workDays + restDays;
  const diffDays = Math.round(
    (startOfDay(secondRestDate).getTime() - startOfDay(firstRestDate).getTime()) / MS_PER_DAY,
  );
  return restDays >= 2 ? diffDays === 1 : diffDays === cycleLength;
}
