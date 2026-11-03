import { EXIT_RATINGS, EXIT_REASONS, type ExitRatingKey, type ExitReasonKey, type WouldReturn } from "./interview";

export type InterviewImportField =
  | "name"
  | "matricula"
  | "interviewDate"
  | "primaryReason"
  | "otherReasons"
  | "wouldReturn"
  | "destination"
  | "comments"
  | "interviewer"
  | ExitRatingKey;

export const INTERVIEW_IMPORT_FIELDS: { key: InterviewImportField; label: string; required: boolean }[] = [
  { key: "name", label: "Nome do colaborador (liga ao desligamento já importado)", required: true },
  { key: "primaryReason", label: "Motivo principal da saída (texto livre; o SIGO classifica)", required: true },
  { key: "matricula", label: "Matrícula / SAP (ajuda a achar o desligamento certo)", required: false },
  { key: "interviewDate", label: "Data da entrevista (vazio = data do desligamento)", required: false },
  { key: "otherReasons", label: "Outros fatores que pesaram", required: false },
  { key: "comments", label: "O que o colaborador disse (resumo / observações)", required: false },
  { key: "wouldReturn", label: "Voltaria a trabalhar aqui? (sim / talvez / não)", required: false },
  { key: "destination", label: "Para onde vai (empresa ou segmento)", required: false },
  { key: "interviewer", label: "Entrevistador", required: false },
  { key: "lideranca", label: "Nota da liderança (1 a 5)", required: false },
  { key: "salario", label: "Nota do salário (1 a 5)", required: false },
  { key: "beneficios", label: "Nota dos benefícios (1 a 5)", required: false },
  { key: "ambiente", label: "Nota do ambiente (1 a 5)", required: false },
  { key: "treinamento", label: "Nota do treinamento e integração (1 a 5)", required: false },
];

export type InterviewImportMapping = Partial<Record<InterviewImportField, number>>;

export const INTERVIEW_FIELD_ALIASES: Record<InterviewImportField, string[]> = {
  name: ["nomedocolaborador", "nomedoentrevistado", "nomedofuncionario", "nomecompleto", "=nome", "=colaborador", "=entrevistado", "=funcionario"],
  matricula: ["=matricula", "=chapa", "=sap", "=registro"],
  interviewDate: ["datadaentrevista", "dataentrevista", "=data"],
  primaryReason: ["motivoprincipal", "principalmotivo", "motivodasaida", "motivododesligamento", "motivodademissao", "razaodasaida", "porquesaiu", "=motivo"],
  otherReasons: ["outrosmotivos", "outrosfatores", "motivossecundarios", "demaismotivos", "fatores"],
  wouldReturn: ["voltariaatrabalhar", "voltaria", "retornaria", "recontrataria"],
  destination: ["paraondevai", "destino", "proximaempresa", "novoemprego", "empresadestino"],
  comments: ["comentarios", "observacoes", "observacao", "relato", "resumo", "feedback", "=obs"],
  interviewer: ["entrevistador", "entrevistadopor", "=responsavel"],
  lideranca: ["notalideranca", "avaliacaolideranca", "lideranca", "chefia"],
  salario: ["notasalario", "avaliacaosalario", "remuneracao"],
  beneficios: ["notabeneficios", "avaliacaobeneficios", "beneficios"],
  ambiente: ["notaambiente", "avaliacaoambiente", "ambientedetrabalho"],
  treinamento: ["notatreinamento", "avaliacaotreinamento", "integracao", "treinamento"],
};

const squash = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase();

/** Palavras que indicam cada motivo, na ordem de prioridade (o primeiro que casa é o principal). */
const REASON_WORDS: [ExitReasonKey, string[]][] = [
  ["PROPOSTA", ["proposta", "outra empresa", "outro emprego", "novo emprego", "melhor oportunidade", "concorrente", "convite"]],
  ["SALARIO", ["salario", "remuneracao", "pagamento", "piso", "ganhava", "valor da hora"]],
  ["BENEFICIOS", ["beneficio", "vale ", "plano de saude", "cesta", "refeicao", "alimentacao"]],
  ["LIDERANCA", ["lideranca", "chefe", "chefia", "gestor", "supervisor", "lider", "gerente", "coordenador"]],
  ["CLIMA", ["clima", "ambiente", "colegas", "equipe", "relacionamento", "assedio", "conflito", "discussao"]],
  ["CARGA_ESCALA", ["escala", "carga de trabalho", "carga horaria", "horario", "jornada", "folga", "hora extra", "cansaco", "sobrecarga", "6x1", "turno"]],
  ["CRESCIMENTO", ["crescimento", "promocao", "carreira", "desenvolvimento", "oportunidade de crescer", "reconhecimento"]],
  ["DISTANCIA", ["distancia", "transporte", "onibus", "deslocamento", "longe", "mudanca de cidade", "mudou de cidade"]],
  ["SAUDE_PESSOAL", ["saude", "familia", "pessoal", "doenca", "filho", "filha", "gravidez", "gestacao", "casamento", "cuidar"]],
  ["ADAPTACAO", ["adapt", "nao gostou", "nao gosta", "funcao", "atividade", "servico pesado", "trabalho pesado", "identific"]],
];

/** Todos os motivos que o texto cita, na ordem de prioridade. Texto sem nenhuma palavra conhecida vira "Outro". Sem texto, vazio. */
export function classifyExitReasons(text: string | null): ExitReasonKey[] {
  if (!text || text.trim() === "") return [];
  const t = squash(text);
  const hits = REASON_WORDS.filter(([, words]) => words.some((w) => t.includes(w))).map(([key]) => key);
  return hits.length > 0 ? hits : ["OUTRO"];
}

export function classifyExitReason(text: string | null): ExitReasonKey | null {
  return classifyExitReasons(text)[0] ?? null;
}

export function parseWouldReturn(text: string | null): WouldReturn | null {
  if (!text) return null;
  const t = squash(text).trim();
  if (t === "") return null;
  if (t.startsWith("talvez") || t.includes("depende") || t.includes("quem sabe")) return "TALVEZ";
  if (t.startsWith("nao") || t.includes("jamais") || t.includes("nunca")) return "NAO";
  if (t.startsWith("sim") || t.includes("voltaria") || t.includes("com certeza") || t === "s") return "SIM";
  return null;
}

/** "4", "4,0", "4/5", "nota 5" → 4; fora de 1 a 5 não vale. */
export function parseRating(text: string | null): number | null {
  if (!text) return null;
  const m = text.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]));
  return n >= 1 && n <= 5 ? n : null;
}

export const RATING_KEYS = EXIT_RATINGS.map((r) => r.key);
export const REASON_KEYS = EXIT_REASONS.map((r) => r.key);
