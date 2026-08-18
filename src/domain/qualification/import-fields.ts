export type QualificationImportField = "matricula" | "cpf" | "name" | "qualificationType" | "completedDate" | "notes";

export const QUALIFICATION_IMPORT_FIELDS: { key: QualificationImportField; label: string; required: boolean }[] = [
  { key: "matricula", label: "Matrícula", required: false },
  { key: "cpf", label: "CPF", required: false },
  { key: "name", label: "Nome (conferência)", required: false },
  { key: "qualificationType", label: "Tipo (NR/ASO/Integração)", required: true },
  { key: "completedDate", label: "Data de conclusão", required: true },
  { key: "notes", label: "Observações", required: false },
];

export type QualificationImportMapping = Partial<Record<QualificationImportField, number>>;
