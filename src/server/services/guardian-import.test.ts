import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/services/audit", () => ({ recordAudit: vi.fn() }));

import { parseGuardianWorkbook } from "./guardian-import.service";

const GROUPS = ["Registro", "Registro", "Registro", "Registro", "Ocorrência", "Reportador", "Reportador", "Observador", "Observador", "Observador", "Observador"];
const HEADERS = [
  "ID do Registro",
  "Data do Registro",
  "Hora do Registro",
  "Tipo do Registro",
  "Descrição da Ocorrência",
  "Nome do Reportador",
  "ID do Reportador",
  "Observado por outra pessoa?",
  "Nome do Observador",
  "ID do Observador",
  "Empresa do Observador",
];

function workbook(rows: string[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([GROUPS, HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("parseGuardianWorkbook — quem observou é quem recebe o crédito", () => {
  it("observado por outra pessoa: o relato é do observador, não do titular da conta", async () => {
    const rows = await parseGuardianWorkbook(
      workbook([["R-1", "10/10/2026", "10:00:00", "Comportamento de Risco", "x", "PAMELA DA SILVA VAZ", "111", "Sim", "GUSTAVO GODOI", "222", "Log20"]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].reporterName).toBe("GUSTAVO GODOI");
    expect(rows[0].reporterExternalId).toBe("222");
    expect(rows[0].reporterCompany).toBe("Log20");
    // a linha original continua guardada, com o titular da conta
    expect(rows[0].raw["Nome do Reportador"]).toBe("PAMELA DA SILVA VAZ");
  });

  it("não foi observado por outra pessoa: continua do titular", async () => {
    const rows = await parseGuardianWorkbook(
      workbook([["R-2", "10/10/2026", "10:00:00", "Condição de Risco", "x", "PAMELA DA SILVA VAZ", "111", "Não", "PAMELA DA SILVA VAZ", "111", "Log20"]]),
    );
    expect(rows[0].reporterName).toBe("PAMELA DA SILVA VAZ");
    expect(rows[0].reporterExternalId).toBe("111");
  });

  it("observado por outra pessoa mas sem nome do observador: fica com o titular", async () => {
    const rows = await parseGuardianWorkbook(
      workbook([["R-3", "10/10/2026", "10:00:00", "Incidente", "x", "PAMELA DA SILVA VAZ", "111", "Sim", "", "", ""]]),
    );
    expect(rows[0].reporterName).toBe("PAMELA DA SILVA VAZ");
  });
});
