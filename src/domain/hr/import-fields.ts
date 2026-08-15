export type ImportField = "name" | "matricula" | "cpf" | "pis" | "salary" | "cargo" | "phone" | "admissionDate";

export const IMPORT_FIELDS: { key: ImportField; label: string; required: boolean }[] = [
  { key: "name", label: "Nome", required: true },
  { key: "matricula", label: "Matrícula", required: false },
  { key: "cpf", label: "CPF", required: false },
  { key: "pis", label: "PIS/NIT", required: false },
  { key: "salary", label: "Salário", required: false },
  { key: "cargo", label: "Cargo", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "admissionDate", label: "Data de admissão", required: false },
];

export type ImportMapping = Partial<Record<ImportField, number>>;
