export type TerminationImportField = "name" | "terminationDate" | "admissionDate" | "matricula" | "cargo" | "area" | "turno" | "kind" | "reason" | "notes";

export const TERMINATION_IMPORT_FIELDS: { key: TerminationImportField; label: string; required: boolean }[] = [
  { key: "name", label: "Nome do colaborador", required: true },
  { key: "terminationDate", label: "Data do desligamento", required: true },
  { key: "admissionDate", label: "Data de admissão (dá o tempo de casa)", required: false },
  { key: "matricula", label: "Matrícula / SAP (liga ao cadastro do colaborador)", required: false },
  { key: "cargo", label: "Cargo / função", required: false },
  { key: "area", label: "Área / setor", required: false },
  { key: "turno", label: "Turno", required: false },
  { key: "kind", label: "Forma de demissão (pedido de demissão, dispensa, acordo, redução de QLP...) — é ela que define se conta no turnover", required: false },
  { key: "reason", label: "Motivo do desligamento", required: false },
  { key: "notes", label: "Observações", required: false },
];

export type TerminationImportMapping = Partial<Record<TerminationImportField, number>>;

/** Nomes de coluna reconhecidos por campo (sem acento/pontuação). "=" na frente: só vale se a coluna tiver exatamente esse nome. */
export const TERMINATION_FIELD_ALIASES: Record<TerminationImportField, string[]> = {
  name: ["nomedocolaborador", "nomedofuncionario", "nomecompleto", "=nome", "=colaborador", "=funcionario"],
  terminationDate: ["datadedesligamento", "datadesligamento", "datadademissao", "datademissao", "datadarescisao", "datarescisao", "=desligamento", "=demissao", "=rescisao"],
  admissionDate: ["datadeadmissao", "dataadmissao", "=admissao"],
  matricula: ["=matricula", "=chapa", "=sap", "=registro", "=codigo"],
  cargo: ["=cargo", "=funcao"],
  area: ["=area", "=setor", "=departamento", "=secao"],
  turno: ["=turno"],
  kind: ["formadedemissao", "formadedesligamento", "formadadispensa", "tipodedesligamento", "tipodesligamento", "tipodedispensa", "iniciativa", "modalidade", "=tipo"],
  reason: ["motivododesligamento", "motivodesligamento", "motivodademissao", "causadodesligamento", "=motivo", "=causa"],
  notes: ["observacoes", "observacao", "=obs"],
};
