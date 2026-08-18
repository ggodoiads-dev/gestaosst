export type EquipmentImportField =
  | "code"
  | "name"
  | "assetTag"
  | "equipmentType"
  | "area"
  | "sector"
  | "manufacturer"
  | "model"
  | "serialNumber"
  | "criticality"
  | "notes";

export const EQUIPMENT_IMPORT_FIELDS: { key: EquipmentImportField; label: string; required: boolean }[] = [
  { key: "code", label: "Código", required: true },
  { key: "name", label: "Nome", required: true },
  { key: "equipmentType", label: "Tipo", required: false },
  { key: "area", label: "Área", required: false },
  { key: "assetTag", label: "Patrimônio", required: false },
  { key: "sector", label: "Setor", required: false },
  { key: "manufacturer", label: "Fabricante", required: false },
  { key: "model", label: "Modelo", required: false },
  { key: "serialNumber", label: "Nº de série", required: false },
  { key: "criticality", label: "Criticidade (Baixa/Média/Alta/Crítica)", required: false },
  { key: "notes", label: "Observações", required: false },
];

export type EquipmentImportMapping = Partial<Record<EquipmentImportField, number>>;
