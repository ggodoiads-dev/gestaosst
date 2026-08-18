import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { IMPORT_FIELDS, type ImportField, type ImportMapping } from "@/domain/hr/import-fields";

export type { ImportField, ImportMapping };

const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["nome", "colaborador", "funcionario"],
  matricula: ["matricula", "registro", "codigo"],
  cpf: ["cpf"],
  pis: ["pis", "nit", "pisnit", "pispasep"],
  salary: ["salario", "remuneracao", "sal"],
  cargo: ["cargo", "posicao", "cbo"],
  jobFunction: ["funcao", "função"],
  turno: ["equipe", "turno", "turma"],
  phone: ["telefone", "celular", "fone", "contato"],
  admissionDate: ["admissao", "dataadmissao", "contratacao", "admissional"],
};

/** Remove acentos (via decomposição NFD + descarte dos marcadores combinantes, codepoint 0x0300+) e normaliza pra comparação de cabeçalhos. */
function normalize(s: string): string {
  return Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Sugere o mapeamento de colunas casando o cabeçalho normalizado com apelidos conhecidos por campo. */
export function suggestMapping(headers: string[]): ImportMapping {
  const result: ImportMapping = {};
  const normalizedHeaders = headers.map(normalize);
  for (const field of IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field.key];
    const idx = normalizedHeaders.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
    if (idx >= 0) result[field.key] = idx;
  }
  return result;
}

export type ParsedSheet = { headers: string[]; rows: string[][] };

function cellToString(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result !== undefined) return String(v.result);
    return "";
  }
  return String(v);
}

function parseCsv(text: string): ParsedSheet {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const delimiter = lines[0]?.includes(";") && !lines[0]?.includes(",") ? ";" : ",";
  const parseLine = (line: string) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const [headerLine, ...dataLines] = lines;
  return {
    headers: headerLine ? parseLine(headerLine) : [],
    rows: dataLines.map(parseLine),
  };
}

/** Aceita .xlsx/.xls (via ExcelJS) ou .csv (parser simples embutido). Só a primeira planilha é lida. */
export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  if (filename.toLowerCase().endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const allRows: string[][] = [];
  sheet.eachRow((row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    allRows.push(values.map(cellToString));
  });

  const [headers, ...dataRows] = allRows;
  return { headers: headers ?? [], rows: dataRows };
}

function getCell(row: string[], mapping: ImportMapping, field: ImportField): string | null {
  const idx = mapping[field];
  if (idx === undefined || idx === null) return null;
  const raw = row[idx];
  return raw && raw.trim() !== "" ? raw.trim() : null;
}

function parseSalaryCell(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(,|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseDateCell(raw: string | null): Date | null {
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12);
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export type ImportRowResult = {
  rowIndex: number;
  action: "create" | "update" | "error";
  name: string;
  matricula: string | null;
  cpf: string | null;
  pis: string | null;
  cargo: string | null;
  jobFunction: string | null;
  turno: string | null;
  turnoId?: string;
  phone: string | null;
  salary: number | null;
  admissionDate: string | null;
  collaboratorId?: string;
  error?: string;
};

/** Monta o preview linha a linha: casa por matrícula, depois por CPF, senão propõe criação. Não escreve nada. */
export async function buildImportPreview(
  user: CurrentUser,
  rows: string[][],
  mapping: ImportMapping,
): Promise<ImportRowResult[]> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const results: ImportRowResult[] = [];
  const turnos = mapping.turno !== undefined ? await db.turno.findMany({ where: { active: true } }) : [];
  const findTurnoId = (name: string | null) =>
    name ? turnos.find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase())?.id : undefined;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || c.trim() === "")) continue;

    const name = getCell(row, mapping, "name");
    const matricula = getCell(row, mapping, "matricula");
    const cpf = getCell(row, mapping, "cpf");
    const pis = getCell(row, mapping, "pis");
    const cargo = getCell(row, mapping, "cargo");
    const jobFunction = getCell(row, mapping, "jobFunction");
    const turno = getCell(row, mapping, "turno");
    const phone = getCell(row, mapping, "phone");
    const salary = parseSalaryCell(getCell(row, mapping, "salary"));
    const admissionDate = parseDateCell(getCell(row, mapping, "admissionDate"));

    const base = {
      rowIndex: i,
      name: name ?? "",
      matricula,
      cpf,
      pis,
      cargo,
      jobFunction,
      turno,
      turnoId: findTurnoId(turno),
      phone,
      salary,
      admissionDate: admissionDate ? admissionDate.toISOString().slice(0, 10) : null,
    };

    if (!name) {
      results.push({ ...base, action: "error", error: "Nome não encontrado nessa linha." });
      continue;
    }

    let existing = matricula ? await db.collaborator.findUnique({ where: { matricula } }) : null;
    if (!existing && cpf) existing = await db.collaborator.findFirst({ where: { cpf } });

    results.push({ ...base, action: existing ? "update" : "create", collaboratorId: existing?.id });
  }

  return results;
}

/** Acha ou cria a `JobFunction` pelo nome exato vindo da planilha, com cache local pra não
 * repetir a mesma consulta/criação a cada linha com a mesma função (ex: "AMARRADOR" 12 vezes).
 * Não usa `applyJobFunctionKit` de propósito — importação em massa não deve gerar entrega de
 * EPI automática pra todo mundo, só ligar o cadastro já existente à função correta. */
async function resolveJobFunctionId(name: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const jobFunction = await db.jobFunction.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  cache.set(name, jobFunction.id);
  return jobFunction.id;
}

/**
 * Aplica de fato as linhas já revisadas (vindas do preview, possivelmente após o usuário
 * remover algumas). Segue linha a linha em vez de uma transação única — um erro isolado não
 * derruba o lote inteiro, e o resumo final mostra exatamente quantas deram certo.
 */
export async function commitImport(
  user: CurrentUser,
  rows: ImportRowResult[],
): Promise<{ created: number; updated: number; errors: number; turnoNotFound: string[] }> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  let created = 0;
  let updated = 0;
  let errors = 0;
  const jobFunctionCache = new Map<string, string>();
  const turnoNotFound = new Set<string>();

  for (const row of rows) {
    if (row.action === "error") {
      errors++;
      continue;
    }
    try {
      const functionId = row.jobFunction ? await resolveJobFunctionId(row.jobFunction, jobFunctionCache) : undefined;
      if (row.turno && !row.turnoId) turnoNotFound.add(row.turno);
      const data = {
        name: row.name,
        matricula: row.matricula,
        cpf: row.cpf,
        pis: row.pis,
        cargo: row.cargo,
        functionId,
        turnoId: row.turnoId,
        phone: row.phone,
        admissionDate: row.admissionDate ? new Date(`${row.admissionDate}T12:00:00`) : null,
        salary: row.salary,
      };
      if (row.action === "update" && row.collaboratorId) {
        await db.collaborator.update({ where: { id: row.collaboratorId }, data });
        updated++;
      } else {
        await db.collaborator.create({ data });
        created++;
      }
    } catch (error) {
      console.error(`[hr-import] falha ao importar linha ${row.rowIndex}:`, error);
      errors++;
    }
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "HrImport",
    entityId: crypto.randomUUID(),
    newValue: { created, updated, errors, total: rows.length },
  });

  return { created, updated, errors, turnoNotFound: [...turnoNotFound] };
}
