export type AccidentImportField =
  | "date"
  | "time"
  | "type"
  | "severity"
  | "area"
  | "description"
  | "immediateCause"
  | "rootCause"
  | "isSif"
  | "sifClassification"
  | "creditNumber"
  | "company"
  | "involvedCollaborators"
  | "involvedFirstName"
  | "involvedLastName"
  | "involvedSap"
  | "involvedCargo"
  | "status";

export const ACCIDENT_IMPORT_FIELDS: { key: AccidentImportField; label: string; required: boolean }[] = [
  { key: "date", label: "Data", required: true },
  { key: "type", label: "Tipo (Acidente Típico/Trajeto, Quase Acidente, Doença Ocupacional) — vazio ou não reconhecido usa o tipo padrão", required: false },
  { key: "severity", label: "Severidade (Baixa/Média/Alta/Crítica)", required: true },
  { key: "description", label: "Descrição", required: true },
  { key: "time", label: "Hora", required: false },
  { key: "area", label: "Área", required: false },
  { key: "immediateCause", label: "Causa imediata", required: false },
  { key: "rootCause", label: "Causa raiz", required: false },
  { key: "isSif", label: "É SIF? (Sim/Não)", required: false },
  { key: "sifClassification", label: "Classificação SIF (Precursor/Potencial/Real)", required: false },
  { key: "creditNumber", label: "Nº do Credit", required: false },
  { key: "company", label: "Empresa (só entram as linhas da LOG20; as outras são ignoradas)", required: false },
  { key: "involvedCollaborators", label: "Colaboradores envolvidos (nomes, separados por vírgula)", required: false },
  { key: "involvedFirstName", label: "Envolvido: primeiro nome (junta com o último nome)", required: false },
  { key: "involvedLastName", label: "Envolvido: último nome / sobrenome", required: false },
  { key: "involvedSap", label: "Envolvido: número de identificação (SAP)", required: false },
  { key: "involvedCargo", label: "Envolvido: cargo", required: false },
  { key: "status", label: "Status (Aberto/Em investigação/Concluído)", required: false },
];

export type AccidentImportMapping = Partial<Record<AccidentImportField, number>>;

/** Empresa da linha é a LOG20? ("LOG20", "LOG 20", "Log-20 Logística"...). A planilha do Credit traz também outras empresas. */
export function isLog20Company(company: string): boolean {
  return company
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .includes("log20");
}
