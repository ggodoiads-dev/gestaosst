import type { QuestionType } from "@/generated/prisma/enums";

export type AnswerOption = { value: string; label: string };

/**
 * Conjuntos de resposta fixos para os tipos de pergunta de escolha pré-definida
 * (seção 18 do documento). Tipos de múltipla escolha/seleção única usam as
 * opções cadastradas em ChecklistQuestionOption, não este conjunto.
 */
export const FIXED_ANSWER_OPTIONS: Partial<Record<QuestionType, AnswerOption[]>> = {
  CONFORME_NAO_CONFORME: [
    { value: "CONFORME", label: "Conforme" },
    { value: "NAO_CONFORME", label: "Não conforme" },
  ],
  SIM_NAO: [
    { value: "SIM", label: "Sim" },
    { value: "NAO", label: "Não" },
  ],
  BOM_REGULAR_RUIM: [
    { value: "BOM", label: "Bom" },
    { value: "REGULAR", label: "Regular" },
    { value: "RUIM", label: "Ruim" },
  ],
  CONFIRMACAO: [{ value: "CONFIRMADO", label: "Confirmado" }],
};

export const NOT_APPLICABLE_VALUE = "NAO_APLICAVEL";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  CONFORME_NAO_CONFORME: "Conforme / Não conforme",
  SIM_NAO: "Sim / Não",
  BOM_REGULAR_RUIM: "Bom / Regular / Ruim",
  MULTIPLA_ESCOLHA: "Múltipla escolha",
  SELECAO_UNICA: "Seleção única",
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  NUMERO: "Número",
  DATA: "Data",
  FOTO: "Foto",
  CONFIRMACAO: "Confirmação",
};

export function questionHasFixedOptions(type: QuestionType): boolean {
  return type in FIXED_ANSWER_OPTIONS;
}

export function questionUsesCustomOptions(type: QuestionType): boolean {
  return type === "MULTIPLA_ESCOLHA" || type === "SELECAO_UNICA";
}

export function questionRequiresRuleTrigger(type: QuestionType): boolean {
  return questionHasFixedOptions(type) || questionUsesCustomOptions(type);
}
