/**
 * Escada de medidas disciplinares. Cada MOTIVO tem a sua própria escada (matriz paralela): o checklist não realizado
 * e a falta injustificada contam separados, e a medida sempre segue a mesma ordem pelo mesmo motivo.
 */
export const DISCIPLINE_STEPS = [
  { key: "DTO_1", label: "1º DTO" },
  { key: "DTO_2", label: "2º DTO" },
  { key: "ADV_VERBAL", label: "Advertência verbal" },
  { key: "ADV_ESCRITA_1", label: "1ª advertência escrita" },
  { key: "ADV_ESCRITA_2", label: "2ª advertência escrita" },
  { key: "SUSPENSAO_1", label: "Suspensão de 1 dia" },
  { key: "SUSPENSAO_3", label: "Suspensão de 3 dias" },
  { key: "COMITE", label: "Comitê" },
] as const;

export type DisciplineStepKey = (typeof DISCIPLINE_STEPS)[number]["key"];

export const DISCIPLINE_REASONS = [
  { key: "CHECKLIST", label: "Checklist não realizado" },
  { key: "FALTA", label: "Falta injustificada" },
] as const;

export type DisciplineReasonKey = (typeof DISCIPLINE_REASONS)[number]["key"];

/** As medidas começam a contar neste dia (checklist e falta): o histórico anterior não vira punição retroativa. */
export const DISCIPLINE_START_KEY = "2026-10-21";

export function disciplineStepLabel(key: string): string {
  return DISCIPLINE_STEPS.find((s) => s.key === key)?.label ?? key;
}

export function disciplineReasonLabel(key: string): string {
  return DISCIPLINE_REASONS.find((r) => r.key === key)?.label ?? key;
}

/** Próxima medida de quem já tem `appliedCount` medidas aplicadas por esse motivo. Depois do comitê não há mais degrau. */
export function nextDisciplineStep(appliedCount: number): DisciplineStepKey {
  return DISCIPLINE_STEPS[Math.min(Math.max(appliedCount, 0), DISCIPLINE_STEPS.length - 1)].key;
}

/** Quem faz menos que isso (em %) do checklist exigido no dia entra na escada de medidas disciplinares. */
export const DISCIPLINE_CHECKLIST_MIN_PERCENT = 80;

/**
 * Um dia de checklist vira ocorrência quando a pessoa fez MENOS de 80% dos equipamentos que eram exigidos nele. Equipamento
 * que não podia ser inspecionado no dia (bloqueado/manutenção) não era exigido; justificativa que conta como cumprida vale
 * como feito.
 */
export function isChecklistInfraction(args: { required: number; doneOrJustified: number }): boolean {
  return args.required > 0 && args.doneOrJustified * 100 < args.required * DISCIPLINE_CHECKLIST_MIN_PERCENT;
}
