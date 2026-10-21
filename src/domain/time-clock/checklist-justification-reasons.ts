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
  FOLGA_FERIAS_APROVADA: { label: "Colaborador faltou, de folga ou férias", countsAsCompliant: true },
  EQUIPAMENTO_INDISPONIVEL: { label: "Equipamento parado ou não utilizado no dia", countsAsCompliant: true },
  FALHA_SISTEMA: { label: "Falha do sistema (checklist feito mas não registrado)", countsAsCompliant: true },
  TREINAMENTO_OUTRA_ATIVIDADE: { label: "Em treinamento ou deslocado pra outra atividade", countsAsCompliant: true },
  SEM_JUSTIFICATIVA: { label: "Sem justificativa válida", countsAsCompliant: false },
  OUTRO: { label: "Outro", countsAsCompliant: false },
};

/** Motivos oferecidos ao justificar os equipamentos do checklist de um colaborador (pode ser item a item ou todos de
 * uma vez, ex: quando ele faltou). "Outro" documenta mas não conta como cumprido — mesma regra do catálogo acima. */
export const CHECKLIST_ITEM_JUSTIFICATION_REASON_OPTIONS = (
  ["FOLGA_FERIAS_APROVADA", "ATESTADO_MEDICO", "EQUIPAMENTO_INDISPONIVEL", "FALHA_SISTEMA", "TREINAMENTO_OUTRA_ATIVIDADE", "OUTRO"] as ChecklistJustificationReason[]
).map((key) => ({ key, ...CHECKLIST_JUSTIFICATION_REASONS[key] }));

export const CHECKLIST_JUSTIFICATION_REASON_OPTIONS = (
  Object.keys(CHECKLIST_JUSTIFICATION_REASONS) as ChecklistJustificationReason[]
).map((key) => ({ key, ...CHECKLIST_JUSTIFICATION_REASONS[key] }));
