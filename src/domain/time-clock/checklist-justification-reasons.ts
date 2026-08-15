import type { ChecklistJustificationReason } from "@/generated/prisma/enums";

export type { ChecklistJustificationReason };

/**
 * Catálogo fixo de motivos de justificativa — cada motivo já define se conta como cumprido
 * pra aderência, pra manter o cálculo consistente entre quem justifica (RH ou Supervisão) em
 * vez de deixar isso a critério de quem preenche.
 */
export const CHECKLIST_JUSTIFICATION_REASONS: Record<
  ChecklistJustificationReason,
  { label: string; countsAsCompliant: boolean }
> = {
  ATESTADO_MEDICO: { label: "Atestado médico", countsAsCompliant: true },
  FOLGA_FERIAS_APROVADA: { label: "Férias ou folga aprovada", countsAsCompliant: true },
  EQUIPAMENTO_INDISPONIVEL: { label: "Equipamento parado ou não utilizado no dia", countsAsCompliant: true },
  FALHA_SISTEMA: { label: "Falha do sistema (checklist feito mas não registrado)", countsAsCompliant: true },
  TREINAMENTO_OUTRA_ATIVIDADE: { label: "Em treinamento ou deslocado pra outra atividade", countsAsCompliant: true },
  SEM_JUSTIFICATIVA: { label: "Sem justificativa válida", countsAsCompliant: false },
  OUTRO: { label: "Outro", countsAsCompliant: false },
};

export const CHECKLIST_JUSTIFICATION_REASON_OPTIONS = (
  Object.keys(CHECKLIST_JUSTIFICATION_REASONS) as ChecklistJustificationReason[]
).map((key) => ({ key, ...CHECKLIST_JUSTIFICATION_REASONS[key] }));
