import { describe, expect, it } from "vitest";
import { evaluateChecklist, type QuestionInput, type QuestionRuleInput } from "./rule-engine";
import { NOT_APPLICABLE_VALUE } from "./answer-values";

function rule(overrides: Partial<QuestionRuleInput> = {}): QuestionRuleInput {
  return {
    id: "rule-1",
    questionId: "q1",
    triggerValue: "NAO",
    isCritical: false,
    requiresComment: false,
    requiresPhoto: false,
    createsNonconformity: false,
    blocksEquipment: false,
    newEquipmentStatus: null,
    severity: null,
    faultCategoryId: null,
    ...overrides,
  };
}

function question(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    id: "q1",
    type: "SIM_NAO",
    required: true,
    allowNotApplicable: false,
    rules: [],
    ...overrides,
  };
}

describe("evaluateChecklist", () => {
  it("libera o equipamento quando todas as respostas são conformes", () => {
    const questions = [question({ id: "q1" }), question({ id: "q2" })];
    const answers = [
      { questionId: "q1", value: "SIM", comment: null, hasPhoto: false },
      { questionId: "q2", value: "SIM", comment: null, hasPhoto: false },
    ];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(true);
    expect(result.result).toBe("LIBERADO");
    expect(result.newEquipmentStatus).toBe("LIBERADO");
    expect(result.triggeredDeviations).toHaveLength(0);
  });

  it("gera LIBERADO_COM_OBSERVACAO para desvio de severidade baixa sem bloqueio", () => {
    const questions = [
      question({ id: "q1", rules: [rule({ severity: "BAIXA", createsNonconformity: true })] }),
    ];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.result).toBe("LIBERADO_COM_OBSERVACAO");
  });

  it("gera RESTRITO para desvio de severidade alta sem bloqueio explícito", () => {
    const questions = [question({ id: "q1", rules: [rule({ severity: "ALTA" })] })];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.result).toBe("RESTRITO");
  });

  it("bloqueia o equipamento quando a regra crítica dispara (cenário do freio, seção 74)", () => {
    const questions = [
      question({
        id: "freio",
        rules: [
          rule({
            questionId: "freio",
            triggerValue: "NAO",
            isCritical: true,
            requiresComment: true,
            requiresPhoto: true,
            createsNonconformity: true,
            blocksEquipment: true,
            severity: "CRITICA",
          }),
        ],
      }),
    ];
    const answers = [
      { questionId: "freio", value: "NAO", comment: "Freio não responde.", hasPhoto: true },
    ];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(true);
    expect(result.result).toBe("BLOQUEADO");
    expect(result.newEquipmentStatus).toBe("BLOQUEADO");
    expect(result.isCritical).toBe(true);
    expect(result.triggeredDeviations[0]?.rule.createsNonconformity).toBe(true);
  });

  it("bloqueia mesmo sem severidade crítica quando blocksEquipment está marcado", () => {
    const questions = [question({ id: "q1", rules: [rule({ severity: "MEDIA", blocksEquipment: true })] })];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.result).toBe("BLOQUEADO");
  });

  it("respeita o status de equipamento explícito da regra quando definido", () => {
    const questions = [
      question({ id: "q1", rules: [rule({ severity: "BAIXA", newEquipmentStatus: "RESTRITO" })] }),
    ];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    // resultado do checklist é calculado pela severidade (observação),
    // mas o status do equipamento respeita a definição explícita da regra
    expect(result.result).toBe("LIBERADO_COM_OBSERVACAO");
    expect(result.newEquipmentStatus).toBe("RESTRITO");
  });

  it("reporta pendência quando uma pergunta obrigatória não foi respondida", () => {
    const questions = [question({ id: "q1", required: true })];
    const result = evaluateChecklist(questions, []);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ questionId: "q1", reason: "RESPOSTA_OBRIGATORIA" }]);
  });

  it("considera pergunta FOTO obrigatória respondida quando tem foto anexada, mesmo sem value", () => {
    const questions = [question({ id: "q1", type: "FOTO", required: true })];
    const answers = [{ questionId: "q1", value: null, comment: null, hasPhoto: true }];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reporta pendência em pergunta FOTO obrigatória sem foto anexada", () => {
    const questions = [question({ id: "q1", type: "FOTO", required: true })];
    const answers = [{ questionId: "q1", value: null, comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([{ questionId: "q1", reason: "RESPOSTA_OBRIGATORIA" }]);
  });

  it("exige comentário quando a regra disparada requer comentário", () => {
    const questions = [question({ id: "q1", rules: [rule({ requiresComment: true })] })];
    const answers = [{ questionId: "q1", value: "NAO", comment: "", hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ questionId: "q1", reason: "COMENTARIO_OBRIGATORIO" });
  });

  it("exige foto quando a regra disparada requer foto", () => {
    const questions = [question({ id: "q1", rules: [rule({ requiresPhoto: true })] })];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ questionId: "q1", reason: "FOTO_OBRIGATORIA" });
  });

  it("não avalia regras quando a resposta é Não Aplicável", () => {
    const questions = [
      question({
        id: "q1",
        allowNotApplicable: true,
        rules: [rule({ requiresComment: true, blocksEquipment: true })],
      }),
    ];
    const answers = [{ questionId: "q1", value: NOT_APPLICABLE_VALUE, comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.valid).toBe(true);
    expect(result.result).toBe("LIBERADO");
    expect(result.triggeredDeviations).toHaveLength(0);
  });

  it("considera apenas a regra cujo valor de disparo corresponde à resposta", () => {
    const questions = [
      question({
        id: "q1",
        rules: [rule({ triggerValue: "SIM", blocksEquipment: true }), rule({ triggerValue: "NAO", severity: "BAIXA" })],
      }),
    ];
    const answers = [{ questionId: "q1", value: "NAO", comment: null, hasPhoto: false }];

    const result = evaluateChecklist(questions, answers);

    expect(result.result).toBe("LIBERADO_COM_OBSERVACAO");
  });
});
