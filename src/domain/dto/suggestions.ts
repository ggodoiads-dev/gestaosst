/** Quantos dias um colaborador avaliado precisa esperar para poder ser avaliado de novo num DTO. */
export const DTO_COOLDOWN_DAYS = 60;

/** Justificativa padrão: o DTO foi feito, mas por liderança que não é monitorada na unidade (não está no SIGO/DMPeople). */
export const DTO_JUSTIFICATION_REASON = "Já realizado por liderança não monitorada na unidade";

/** Quem tem menos que isso de casa é prioridade pro primeiro DTO. */
export const DTO_NEW_HIRE_DAYS = 60;

/** Só DTOs dos últimos N dias geram ações no Plano de Ações — prazo "daqui a 2 semanas" pra um DTO de um ano atrás não faz sentido. */
export const DTO_ACTIONS_WINDOW_DAYS = 90;

/** Janela em que um incidente ainda pede um DTO "pós-incidente" (que pode ser feito mesmo dentro dos 60 dias de carência). */
export const DTO_INCIDENT_WINDOW_DAYS = 60;

/** Tipos de ocorrência que pedem DTO com o colaborador. Acidente de trajeto e doença ocupacional não são sobre a
 * execução da atividade, então não entram. */
export const DTO_INCIDENT_TYPES = ["ACIDENTE_TIPICO", "QUASE_ACIDENTE", "FAI"] as const;

/** Funções cujos ocupantes NÃO fazem DTO como avaliador, mesmo estando no quadro ADM. */
export const DTO_NON_EVALUATOR_FUNCTION_KEYWORDS = ["assistente", "conferente"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

function keyDayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Situação do colaborador frente à regra dos 60 dias. `lastEffective` = o DTO ou a justificativa mais recente
 * (datas guardadas como meio-dia UTC do dia de calendário); `todayKey` = hoje em Brasília (AAAA-MM-DD). */
export function dtoCooldown(lastEffective: Date | null, todayKey: string, cooldownDays = DTO_COOLDOWN_DAYS) {
  if (!lastEffective) return { daysSince: null as number | null, eligible: true, eligibleOn: null as Date | null };
  const daysSince = keyDayNumber(todayKey) - dayNumber(lastEffective);
  return {
    daysSince,
    eligible: daysSince >= cooldownDays,
    eligibleOn: new Date((dayNumber(lastEffective) + cooldownDays) * DAY_MS + 12 * 60 * 60 * 1000),
  };
}

/** Dias de casa em `todayKey` (AAAA-MM-DD). `null` se a data de admissão não é conhecida. */
export function tenureDays(admissionDate: Date | null, todayKey: string): number | null {
  if (!admissionDate) return null;
  return keyDayNumber(todayKey) - dayNumber(admissionDate);
}

/** Dias entre `date` (meio-dia UTC do dia de calendário) e `todayKey` (AAAA-MM-DD). */
export function daysSinceDate(date: Date, todayKey: string): number {
  return keyDayNumber(todayKey) - dayNumber(date);
}

/** Incidente que ainda espera DTO: aconteceu e não houve DTO (nem justificativa) no dia dele ou depois. É a ÚNICA exceção
 * à carência de 60 dias. `lastEffective` = último DTO/justificativa; `incidentDate` = data do incidente mais recente. */
export function hasPendingIncident(lastEffective: Date | null, incidentDate: Date | null): boolean {
  if (!incidentDate) return false;
  if (!lastEffective) return true;
  return dayNumber(lastEffective) < dayNumber(incidentDate);
}
