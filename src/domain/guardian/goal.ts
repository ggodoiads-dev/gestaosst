/** Meta mensal de relatos do Guardian: cada pessoa precisa de 2 relatos de ato inseguro (comportamento de risco) no mês. */
export const RISK_ACT_GOAL_PER_PERSON = 2;

export type GoalPerson = { collaboratorId: string; name: string; turnoName: string | null; count: number };

export type GoalProgress = {
  target: number;
  people: number;
  /** Quantos bateram a meta (count >= target). */
  reached: number;
  /** % de pessoas que bateram a meta. */
  reachedPct: number;
  /** Relatos que contam para a meta (cada pessoa conta até o limite da meta: o 3º relato de alguém não cobre o que falta de outra). */
  counted: number;
  /** Total de relatos que a meta pede (meta × pessoas). */
  expected: number;
  /** % da meta total cumprida (counted / expected). */
  coveragePct: number;
};

export function goalProgress(people: Pick<GoalPerson, "count">[], target: number = RISK_ACT_GOAL_PER_PERSON): GoalProgress {
  const reached = people.filter((p) => p.count >= target).length;
  const counted = people.reduce((s, p) => s + Math.min(p.count, target), 0);
  const expected = people.length * target;
  return {
    target,
    people: people.length,
    reached,
    reachedPct: people.length > 0 ? Math.round((reached / people.length) * 100) : 0,
    counted,
    expected,
    coveragePct: expected > 0 ? Math.round((counted / expected) * 100) : 0,
  };
}
