export type QualificationImportField =
  | "matricula"
  | "cpf"
  | "name"
  | "category"
  | "qualificationType"
  | "completedDate"
  | "validityMonths"
  | "nrNumber"
  | "workload"
  | "location"
  | "instructor"
  | "notes";

export const QUALIFICATION_IMPORT_FIELDS: { key: QualificationImportField; label: string; required: boolean }[] = [
  { key: "name", label: "Colaborador (nome)", required: true },
  { key: "matricula", label: "Matrícula (opcional, mais preciso que nome)", required: false },
  { key: "cpf", label: "CPF (opcional, mais preciso que nome)", required: false },
  { key: "category", label: "Categoria (NR/ASO/Integração/Outro)", required: false },
  { key: "qualificationType", label: "Treinamento", required: true },
  { key: "completedDate", label: "Data de realização", required: true },
  { key: "validityMonths", label: "Validade em meses", required: false },
  { key: "nrNumber", label: "NR", required: false },
  { key: "workload", label: "Carga horária", required: false },
  { key: "location", label: "Local", required: false },
  { key: "instructor", label: "Instrutor / palestrante", required: false },
  { key: "notes", label: "Observações", required: false },
];

export type QualificationImportMapping = Partial<Record<QualificationImportField, number>>;
