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
  | "involvedCollaborators"
  | "status";

export const ACCIDENT_IMPORT_FIELDS: { key: AccidentImportField; label: string; required: boolean }[] = [
  { key: "date", label: "Data", required: true },
  { key: "type", label: "Tipo (Acidente Típico/Trajeto, Quase Acidente, Doença Ocupacional)", required: true },
  { key: "severity", label: "Severidade (Baixa/Média/Alta/Crítica)", required: true },
  { key: "description", label: "Descrição", required: true },
  { key: "time", label: "Hora", required: false },
  { key: "area", label: "Área", required: false },
  { key: "immediateCause", label: "Causa imediata", required: false },
  { key: "rootCause", label: "Causa raiz", required: false },
  { key: "isSif", label: "É SIF? (Sim/Não)", required: false },
  { key: "sifClassification", label: "Classificação SIF (Precursor/Potencial/Real)", required: false },
  { key: "creditNumber", label: "Nº do Credit", required: false },
  { key: "involvedCollaborators", label: "Colaboradores envolvidos (nomes, separados por vírgula)", required: false },
  { key: "status", label: "Status (Aberto/Em investigação/Concluído)", required: false },
];

export type AccidentImportMapping = Partial<Record<AccidentImportField, number>>;
