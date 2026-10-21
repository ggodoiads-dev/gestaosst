import { disciplineReasonLabel, disciplineStepLabel, type DisciplineReasonKey, type DisciplineStepKey } from "./ladder";

/** Medidas que geram documento para imprimir e assinar. DTO é uma conversa de orientação (sem papel) e o comitê é
 * encaminhamento — só advertências e suspensões viram documento. */
const DOCUMENT_STEPS: readonly DisciplineStepKey[] = ["ADV_VERBAL", "ADV_ESCRITA_1", "ADV_ESCRITA_2", "SUSPENSAO_1", "SUSPENSAO_3"];

export function stepHasDocument(step: string): boolean {
  return (DOCUMENT_STEPS as readonly string[]).includes(step);
}

const TITLES: Partial<Record<DisciplineStepKey, string>> = {
  ADV_VERBAL: "REGISTRO DE ADVERTÊNCIA VERBAL",
  ADV_ESCRITA_1: "ADVERTÊNCIA ESCRITA — 1ª",
  ADV_ESCRITA_2: "ADVERTÊNCIA ESCRITA — 2ª",
  SUSPENSAO_1: "SUSPENSÃO DISCIPLINAR — 1 DIA",
  SUSPENSAO_3: "SUSPENSÃO DISCIPLINAR — 3 DIAS",
};

const FACTS: Record<DisciplineReasonKey, string> = {
  CHECKLIST:
    "não realizou o checklist de inspeção dos equipamentos do seu turno (nenhum equipamento foi inspecionado), procedimento obrigatório de segurança da operação",
  FALTA: "ausentou-se do trabalho sem justificativa (falta injustificada)",
};

export type MeasureDocumentInput = {
  step: DisciplineStepKey;
  reason: DisciplineReasonKey;
  collaborator: { name: string; matricula: string | null; functionName: string | null; areaName: string | null };
  occurrenceDate: string; // dd/mm/aaaa
  /** Quantas medidas (incluindo esta) já foram aplicadas a essa pessoa por esse motivo. */
  sequence: number;
  note: string | null;
  issuedAt: string; // dd/mm/aaaa
};

export type MeasureDocumentContent = {
  title: string;
  identification: [string, string][];
  paragraphs: string[];
  isSuspension: boolean;
};

/** Texto do documento — separado do Word pra poder testar e ajustar sem mexer na geração do arquivo. */
export function buildMeasureDocumentContent(input: MeasureDocumentInput): MeasureDocumentContent {
  const title = TITLES[input.step] ?? disciplineStepLabel(input.step).toUpperCase();
  const isSuspension = input.step === "SUSPENSAO_1" || input.step === "SUSPENSAO_3";
  const days = input.step === "SUSPENSAO_3" ? "3 (três) dias" : "1 (um) dia";
  const measureWord = input.step === "ADV_VERBAL" ? "advertência verbal" : isSuspension ? `suspensão disciplinar de ${days}` : "advertência escrita";

  const paragraphs = [
    `Pelo presente, a empresa comunica ao(à) colaborador(a) acima identificado(a) que, em ${input.occurrenceDate}, ${FACTS[input.reason]}. Tal conduta configura descumprimento das normas internas e desídia no desempenho das funções (art. 482, alínea "e", da CLT).`,
    `Em razão disso, aplica-se ${input.step === "ADV_VERBAL" ? "a presente" : "a"} ${measureWord}. Esta é a ${input.sequence}ª medida disciplinar registrada para o motivo "${disciplineReasonLabel(input.reason)}".`,
  ];
  if (isSuspension) {
    paragraphs.push(
      `O(A) colaborador(a) fica suspenso(a) por ${days}, no período de ____/____/________ a ____/____/________, devendo retornar às atividades em ____/____/________. Os dias de suspensão não são remunerados.`,
    );
  }
  if (input.note) paragraphs.push(`Observações: ${input.note}`);
  paragraphs.push(
    "Fica ciente o(a) colaborador(a) de que a reincidência poderá acarretar medidas disciplinares mais severas, inclusive a rescisão do contrato de trabalho por justa causa.",
  );

  return {
    title,
    isSuspension,
    identification: [
      ["Colaborador(a)", input.collaborator.name],
      ["Matrícula", input.collaborator.matricula ?? "—"],
      ["Função", input.collaborator.functionName ?? "—"],
      ["Área", input.collaborator.areaName ?? "—"],
      ["Data da ocorrência", input.occurrenceDate],
      ["Motivo", disciplineReasonLabel(input.reason)],
      ["Medida", disciplineStepLabel(input.step)],
      ["Data de emissão", input.issuedAt],
    ],
    paragraphs,
  };
}
