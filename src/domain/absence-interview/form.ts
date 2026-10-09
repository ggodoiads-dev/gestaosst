import { z } from "zod";

/** Modelo "Entrevista de Absenteísmo — Rev 03/24". Parte A = relato do colaborador; Parte B = avaliação da Gente/Liderança. */
export const FORM_REVISION = "REV 03/24";

export const CLASSIFICATION_LABELS = {
  JUSTIFICADA: "Justificada (abonada)",
  NAO_JUSTIFICADA: "Não justificada (não abonada)",
  PREVISTA_LEI: "Prevista por lei",
} as const;
export type Classification = keyof typeof CLASSIFICATION_LABELS;

export const HEALTH_PROBLEMS = [
  "Doenças sazonais (Influenza, Corona Vírus, Dengue, Zika, Chikungunya, Intoxicação Alimentar, Febre Amarela, entre outras)",
  "Doenças relacionadas a saúde mental (ansiedade, depressão, entre outras)",
  "Dor na coluna (lombar, cervical)",
  "Dor no joelho",
  "Dor na perna",
  "Dor no braço",
  "Dor no pulso",
  "Dor de ouvido",
  "Dor de garganta",
  "Resfriado",
  "Conjuntivite/Problema nos olhos",
  "Dor de cabeça",
  "Dor no ombro",
  "Dor no estômago/Problemas intestinais",
  "Dor muscular",
  "Dor de dente",
  "Febre",
  "Mal estar",
  "Dor abdominal",
  "Pressão alta",
  "Abcesso cutâneo",
  "Dor nas articulações (mãos e pés)",
  "Acompanhamento em consulta",
  "Outros",
] as const;

/** Classificação detalhada (parte B), por tipo de classificação — mesmas opções do formulário original. */
export const CLASSIFICATION_DETAILS: Record<Classification, readonly string[]> = {
  JUSTIFICADA: [
    "Dificuldade com transporte",
    "Excesso jornada dia anterior",
    "Problemas familiares",
    "Problemas pessoais",
    "Saúde - com atestado Médico",
    "Saúde - sem atestado Médico",
  ],
  NAO_JUSTIFICADA: [
    "Abandono de emprego",
    "Descomprometimento",
    "Dificuldade de transporte",
    "Excesso jornada dia anterior",
    "Motivo Não Identificado",
    "Problemas familiares",
    "Problemas pessoais",
    "Saúde - sem atestado Médico",
    "Outros",
  ],
  PREVISTA_LEI: [
    "Audiência / Convocação",
    "Doação de Sangue",
    "Exame Escolar / Vestibular",
    "Falecimento parente/cônjuge",
    "Licença Paternidade",
    "Licença Casamento",
  ],
};

export const ACTIONS_TAKEN = [
  "Reciclagem treinamento / foco normas empresa",
  "Acompanhamento do Colaborador",
  "Advertência verbal",
  "Advertência escrita",
  "Suspensão",
  "Demissão",
  "Não Aplicável",
] as const;

const yesNo = z.enum(["SIM", "NAO"]);
export const YES_NO_LABELS = { SIM: "Sim", NAO: "Não" } as const;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

/** Parte A — o que o COLABORADOR responde: o que aconteceu e os 5 porquês. */
export const employeeAnswersSchema = z.object({
  description: z.string().trim().min(3, "Conte o que aconteceu."),
  fiveWhys: z
    .array(z.string().trim().max(500))
    .max(5)
    .transform((list) => list.filter((w) => w.length > 0))
    .refine((list) => list.length >= 1, "Responda pelo menos o primeiro porquê."),
});
export type EmployeeAnswers = z.infer<typeof employeeAnswersSchema>;

/** Parte B — o que o RH/Liderança responde (conclui a entrevista): detalhamento, classificação e ação tomada. */
export const evaluationSchema = z.object({
  startDate: dateKey,
  endDate: dateKey,
  priorUnjustified: yesNo,
  communicatedBefore: yesNo,
  presentedJustification: yesNo,
  classification: z.enum(["JUSTIFICADA", "NAO_JUSTIFICADA", "PREVISTA_LEI"]),
  detail: z.string().trim().min(1, "Escolha a classificação detalhada."),
  healthProblem: z.string().trim().optional().nullable(),
  crm: z.string().trim().max(40).optional().nullable(),
  cid: z.string().trim().max(40).optional().nullable(),
  actionTaken: z.string().trim().min(1, "Informe a ação tomada."),
  excuseAccepted: yesNo,
  dayDiscounted: yesNo,
  avoidableByDayOff: yesNo,
  hrComments: z.string().trim().max(2000).optional().nullable(),
  leadershipComments: z.string().trim().max(2000).optional().nullable(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;
