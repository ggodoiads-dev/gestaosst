import { describe, expect, it } from "vitest";
import { ACCIDENT_FIELD_ALIASES, ACCIDENT_IMPORT_FIELDS } from "./import-fields";
import { suggestMapping } from "@/lib/spreadsheet-import";

const suggest = (headers: string[]) => suggestMapping(headers, ACCIDENT_IMPORT_FIELDS.map((f) => f.key), ACCIDENT_FIELD_ALIASES);

// Cabeçalhos do "relatório de acidentes" do Credit (trecho, na ordem real da planilha).
const RELATORIO = [
  "Referência", "Esta lesão ocorreu no deslocamento de Trajeto Trabalho/casa/trabalho?", "Solicitação de Expurgo do KPI", "Status do KPI", "Status SIF", "Tipo SIF",
  "Classificação de Incidentes", "Estado do fluxo de trabalho", "Data em que ocorreu o incidente", "Unidade", "Zona", "País", "Região", "Natureza da lesão",
  "Categoria do Incidente", "Descrição do Incidente pelo Gerente", "Departamento onde ocorreu o incidente", "Hora em que Incidente Ocorreu",
  "Date Incident Reporting (If Different)", "Número de Identificação (SAP)", "Primeiro nome", "Último nome", "Cargo", "Departamento", "Tipo de Contratado",
  "Nome da Empresa Terceira", "Contactor Company Name (Other)", "Quem reportou?",
];

describe("sugestão de colunas do relatório de acidentes do Credit", () => {
  const m = suggest(RELATORIO);
  const name = (field: keyof typeof m) => (m[field] === undefined ? null : RELATORIO[m[field]!]);

  it("escolhe as colunas certas, não a primeira que contém a palavra", () => {
    expect(name("type")).toBe("Classificação de Incidentes"); // não "Tipo SIF"
    expect(name("status")).toBe("Estado do fluxo de trabalho"); // não "Status do KPI"
    expect(name("isSif")).toBe("Status SIF");
    expect(name("sifClassification")).toBe("Tipo SIF");
    expect(name("date")).toBe("Data em que ocorreu o incidente");
    expect(name("time")).toBe("Hora em que Incidente Ocorreu");
    expect(name("area")).toBe("Departamento onde ocorreu o incidente"); // não "Localização"/"Unidade"
    expect(name("description")).toBe("Descrição do Incidente pelo Gerente");
    expect(name("creditNumber")).toBe("Referência");
  });

  it("acha empresa, nome, SAP e cargo do envolvido", () => {
    expect(name("company")).toBe("Nome da Empresa Terceira");
    expect(name("involvedFirstName")).toBe("Primeiro nome");
    expect(name("involvedLastName")).toBe("Último nome");
    expect(name("involvedSap")).toBe("Número de Identificação (SAP)");
    expect(name("involvedCargo")).toBe("Cargo");
  });

  it("não inventa severidade (a planilha não tem)", () => {
    expect(m.severity).toBeUndefined();
  });
});

describe("sugestão de colunas da exportação de ocorrências", () => {
  const H = ["ID da ocorrência", "Nome do Incidente de segurança", "Descrição", "Impacto ambiental", "Tipo de Incidente", "Data de ocorrência", "Hora de ocorrência", "Área de ocorrência", "Empresa do relator", "Área/Empresa do relatado"];
  const m = suggest(H);
  it("usa descrição, tipo, data, hora e área desta exportação", () => {
    expect(H[m.description!]).toBe("Descrição");
    expect(H[m.type!]).toBe("Tipo de Incidente");
    expect(H[m.date!]).toBe("Data de ocorrência");
    expect(H[m.time!]).toBe("Hora de ocorrência");
    expect(H[m.area!]).toBe("Área de ocorrência");
    expect(H[m.company!]).toBe("Área/Empresa do relatado");
  });
});
