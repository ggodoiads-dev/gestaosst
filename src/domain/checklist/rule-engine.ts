import type { Criticality, EquipmentStatus, ExecutionResult } from "@/generated/prisma/enums";
import { NOT_APPLICABLE_VALUE } from "@/domain/checklist/answer-values";

/**
 * Motor de regras da execução de checklist (seções 20-21 do documento).
 * Funções puras e testáveis: recebem perguntas/regras/respostas já carregadas
 * do banco e devolvem o resultado determinístico, sem tocar em persistência.
 */

export type QuestionRuleInput = {
  id: string;
  questionId: string;
  triggerValue: string;
  isCritical: boolean;
  requiresComment: boolean;
  requiresPhoto: boolean;
  createsNonconformity: boolean;
  blocksEquipment: boolean;
  newEquipmentStatus: EquipmentStatus | null;
  severity: Criticality | null;
  faultCategoryId: string | null;
};

export type QuestionInput = {
  id: string;
  required: boolean;
  allowNotApplicable: boolean;
  rules: QuestionRuleInput[];
};

export type AnswerInput = {
  questionId: string;
  /** Valor bruto da resposta (texto, número, data, ou o valor/id da opção escolhida). */
  value: string | null;
  comment: string | null;
  hasPhoto: boolean;
};

export type TriggeredDeviation = {
  questionId: string;
  rule: QuestionRuleInput;
};

export type ValidationIssue = {
  questionId: string;
  reason: "RESPOSTA_OBRIGATORIA" | "COMENTARIO_OBRIGATORIO" | "FOTO_OBRIGATORIA";
};

export type RuleEngineResult = {
  valid: boolean;
  issues: ValidationIssue[];
  triggeredDeviations: TriggeredDeviation[];
  result: ExecutionResult;
  newEquipmentStatus: EquipmentStatus;
  isCritical: boolean;
};

const SEVERITY_ORDER: Record<Criticality, number> = {
  BAIXA: 0,
  MEDIA: 1,
  ALTA: 2,
  CRITICA: 3,
};

function findAnswer(answers: AnswerInput[], questionId: string) {
  return answers.find((a) => a.questionId === questionId) ?? null;
}

function matchRule(question: QuestionInput, answer: AnswerInput | null): QuestionRuleInput | null {
  if (!answer || answer.value === null) return null;
  if (answer.value === NOT_APPLICABLE_VALUE) return null;
  return question.rules.find((rule) => rule.triggerValue === answer.value) ?? null;
}

/**
 * Valida obrigatoriedade de resposta/comentário/foto e calcula o resultado
 * final do checklist a partir das regras configuradas por pergunta.
 * Não lança exceção: devolve `valid=false` e a lista de problemas para a
 * camada de serviço decidir como reportar ao usuário.
 */
export function evaluateChecklist(
  questions: QuestionInput[],
  answers: AnswerInput[],
): RuleEngineResult {
  const issues: ValidationIssue[] = [];
  const triggeredDeviations: TriggeredDeviation[] = [];

  for (const question of questions) {
    const answer = findAnswer(answers, question.id);

    if (question.required && (!answer || answer.value === null || answer.value === "")) {
      issues.push({ questionId: question.id, reason: "RESPOSTA_OBRIGATORIA" });
      continue;
    }

    const rule = matchRule(question, answer);
    if (!rule) continue;

    if (rule.requiresComment && !answer?.comment?.trim()) {
      issues.push({ questionId: question.id, reason: "COMENTARIO_OBRIGATORIO" });
    }
    if (rule.requiresPhoto && !answer?.hasPhoto) {
      issues.push({ questionId: question.id, reason: "FOTO_OBRIGATORIA" });
    }

    triggeredDeviations.push({ questionId: question.id, rule });
  }

  const anyBlocks = triggeredDeviations.some((d) => d.rule.blocksEquipment);
  const worstSeverity = triggeredDeviations.reduce<Criticality | null>((worst, d) => {
    if (!d.rule.severity) return worst;
    if (!worst || SEVERITY_ORDER[d.rule.severity] > SEVERITY_ORDER[worst]) return d.rule.severity;
    return worst;
  }, null);

  let result: ExecutionResult;
  if (anyBlocks || worstSeverity === "CRITICA") {
    result = "BLOQUEADO";
  } else if (worstSeverity === "ALTA") {
    result = "RESTRITO";
  } else if (triggeredDeviations.length > 0) {
    result = "LIBERADO_COM_OBSERVACAO";
  } else {
    result = "LIBERADO";
  }

  const explicitStatus = triggeredDeviations.find((d) => d.rule.newEquipmentStatus)?.rule
    .newEquipmentStatus;

  const newEquipmentStatus: EquipmentStatus = explicitStatus ?? (result as EquipmentStatus);

  return {
    valid: issues.length === 0,
    issues,
    triggeredDeviations,
    result,
    newEquipmentStatus,
    isCritical: triggeredDeviations.some((d) => d.rule.isCritical),
  };
}
