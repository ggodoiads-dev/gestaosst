import "server-only";
import * as XLSX from "xlsx";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { normalize } from "@/lib/spreadsheet-import";
import type { GuardianReportType } from "@/generated/prisma/enums";

/** Nome exato de cada aba na exportação do Guardian (Ambev) -> tipo interno. Formato fixo de um
 * sistema externo — diferente dos outros imports do SIGO, não precisa de tela de mapeamento de
 * coluna: as abas e cabeçalhos são sempre os mesmos. */
const SHEET_TYPES: Record<string, GuardianReportType> = {
  comportamento_risco: "COMPORTAMENTO_RISCO",
  condicao: "CONDICAO",
  incidente: "INCIDENTE",
  reconhecimento: "RECONHECIMENTO",
};

/** Acha a coluna certa por comparação exata OU por "começa com" do cabeçalho normalizado — a
 * planilha do Guardian repete "Nome do X"/"Descrição..." em outras colunas mais adiante (ex:
 * "Nome da Zona", "Descrição da Ação"), então pega sempre a primeira ocorrência, que é a certa. */
function findColumn(headers: string[], matcher: (normalized: string) => boolean): number {
  return headers.findIndex((h) => matcher(normalize(h)));
}

type GuardianColumnIndexes = {
  guardianId: number;
  categoryName: number;
  description: number;
  occurredDate: number;
  occurredTime: number;
  reportedDate: number;
  reportedTime: number;
  unit: number;
  area: number;
  subArea: number;
  location: number;
  equipment: number;
  reporterName: number;
  reporterExternalId: number;
  reporterEmail: number;
  reporterCompany: number;
  isAnonymous: number;
};

function resolveColumns(headers: string[]): GuardianColumnIndexes {
  return {
    guardianId: findColumn(headers, (h) => h === "iddaocorrencia"),
    categoryName: findColumn(headers, (h) => h.startsWith("nomeda") || h.startsWith("nomedo")),
    description: findColumn(headers, (h) => h.startsWith("descricao")),
    occurredDate: findColumn(headers, (h) => h === "datadeocorrencia"),
    occurredTime: findColumn(headers, (h) => h === "horadeocorrencia"),
    reportedDate: findColumn(headers, (h) => h === "datadorelato"),
    reportedTime: findColumn(headers, (h) => h === "horadorelato"),
    unit: findColumn(headers, (h) => h === "unidadedeocorrencia"),
    area: findColumn(headers, (h) => h === "areadeocorrencia"),
    subArea: findColumn(headers, (h) => h === "subareadeocorrencia"),
    location: findColumn(headers, (h) => h === "localdeinstalacao"),
    equipment: findColumn(headers, (h) => h === "equipamentodeocorrencia"),
    reporterName: findColumn(headers, (h) => h === "relator"),
    reporterExternalId: findColumn(headers, (h) => h === "idambevdorelator"),
    reporterEmail: findColumn(headers, (h) => h === "emaildorelator"),
    reporterCompany: findColumn(headers, (h) => h === "empresadorelator"),
    isAnonymous: findColumn(headers, (h) => h === "relatadoanonimo"),
  };
}

function cell(row: string[], idx: number): string | null {
  if (idx < 0) return null;
  const v = row[idx];
  return v && v.trim() !== "" ? v.trim() : null;
}

function combineDateTime(dateRaw: string | null, timeRaw: string | null): Date | null {
  if (!dateRaw) return null;
  const m = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  let hh = 12;
  let min = 0;
  let ss = 0;
  const t = timeRaw?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (t) {
    hh = Number(t[1]);
    min = Number(t[2]);
    ss = t[3] ? Number(t[3]) : 0;
  }
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), hh, min, ss);
}

/** Só dígitos — pra comparar CPF/ID Ambev independente de pontuação (alguns exports usam
 * "032.449.649-40", outros "843.005.669.68" pro mesmo formato de CPF). */
function onlyDigits(s: string | null): string | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export type GuardianRawRow = {
  type: GuardianReportType;
  guardianId: string;
  categoryName: string | null;
  description: string | null;
  occurredAt: Date | null;
  reportedAt: Date | null;
  unit: string | null;
  area: string | null;
  subArea: string | null;
  location: string | null;
  equipment: string | null;
  reporterName: string | null;
  reporterExternalId: string | null;
  reporterEmail: string | null;
  reporterCompany: string | null;
  isAnonymous: boolean;
  raw: Record<string, string>;
};

/** Valor da coluna "Tipo do Registro" do formato novo (aba única "Report") -> tipo interno. */
const NEW_FORMAT_TYPES: Record<string, GuardianReportType> = {
  comportamentoderisco: "COMPORTAMENTO_RISCO",
  condicaoderisco: "CONDICAO",
  incidente: "INCIDENTE",
  reconhecimento: "RECONHECIMENTO",
};

/** Formato novo do export do Guardian: UMA aba ("Report") com todos os tipos misturados e dois
 * cabeçalhos empilhados — a 1ª linha só agrupa ("Registro", "Ocorrência", "Reportador"...) e a
 * 2ª tem o nome real de cada coluna ("ID do Registro", "Nome do Reportador"...). Por isso o
 * cabeçalho é procurado nas primeiras linhas pela coluna "ID do Registro". Não há coluna de
 * relato anônimo (reportador sem nome = anônimo) e o "ID do Reportador" costuma vir vazio, então
 * quem casa o colaborador é o nome (ver `buildGuardianImportPreview`). */
function findNewFormatHeaderRow(grid: string[][]): number {
  for (let i = 0; i < Math.min(grid.length, 4); i++) {
    if (grid[i].some((c) => normalize(c ?? "") === "iddoregistro")) return i;
  }
  return -1;
}

function parseNewFormatSheet(grid: string[][], headerRowIdx: number): GuardianRawRow[] {
  const headers = grid[headerRowIdx];
  const col = (name: string) => headers.findIndex((h) => normalize(h ?? "") === normalize(name));
  const idx = {
    guardianId: col("ID do Registro"),
    type: col("Tipo do Registro"),
    registeredDate: col("Data do Registro"),
    registeredTime: col("Hora do Registro"),
    occurredDate: col("Data de Ocorrência"),
    occurredTime: col("Hora de Ocorrência"),
    unit: col("Instalação de Ocorrência"),
    area: col("Área de Ocorrência"),
    subArea: col("Sub Área de Ocorrência"),
    equipment: col("Equipamento de Ocorrência"),
    description: col("Descrição da Ocorrência"),
    reporterName: col("Nome do Reportador"),
    reporterExternalId: col("ID do Reportador"),
    reporterEmail: col("E-mail do Reportador"),
    reporterCompany: col("Empresa do Reportador"),
    safetyCategory: col("Categoria de segurança"),
    safetySubCategory: col("Sub Categoria de segurança"),
    environmentCategory: col("Categoria de ambiente"),
    environmentSubCategory: col("Sub Categoria de ambiente"),
  };
  if (idx.guardianId < 0 || idx.type < 0) return [];

  const rows: GuardianRawRow[] = [];
  for (const row of grid.slice(headerRowIdx + 1)) {
    if (row.every((c) => !c || c.trim() === "")) continue;
    const guardianId = cell(row, idx.guardianId);
    const type = NEW_FORMAT_TYPES[normalize(cell(row, idx.type) ?? "")];
    if (!guardianId || !type) continue;

    const category = [cell(row, idx.safetyCategory), cell(row, idx.safetySubCategory)].filter(Boolean).join(" — ");
    const environment = [cell(row, idx.environmentCategory), cell(row, idx.environmentSubCategory)].filter(Boolean).join(" — ");

    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h && row[i]) raw[h] = row[i];
    });

    const reporterName = cell(row, idx.reporterName);
    rows.push({
      type,
      guardianId,
      categoryName: category || environment || null,
      description: cell(row, idx.description),
      occurredAt: combineDateTime(cell(row, idx.occurredDate), cell(row, idx.occurredTime)),
      reportedAt: combineDateTime(cell(row, idx.registeredDate), cell(row, idx.registeredTime)),
      unit: cell(row, idx.unit),
      area: cell(row, idx.area),
      subArea: cell(row, idx.subArea),
      location: null,
      equipment: cell(row, idx.equipment),
      reporterName,
      reporterExternalId: cell(row, idx.reporterExternalId),
      reporterEmail: cell(row, idx.reporterEmail),
      reporterCompany: cell(row, idx.reporterCompany),
      isAnonymous: !reporterName,
      raw,
    });
  }
  return rows;
}

/** Lê o export do Guardian nos dois formatos: o novo (aba única "Report", ver acima) e o antigo
 * (4 abas, uma por tipo). Abas ausentes ou com nome diferente são simplesmente ignoradas (não é
 * erro — algumas exportações podem vir sem alguma aba se não houve relato daquele tipo no
 * período).
 *
 * Usa `xlsx` (SheetJS) em vez do `exceljs` já usado no resto do SIGO — o export do Guardian
 * grava todo o XML interno com prefixo de namespace (`<x:worksheet>`, `<x:sheet>` etc., em vez
 * do namespace padrão sem prefixo que o Excel de verdade usa), e o exceljs não reconhece esses
 * elementos prefixados: `workbook.xlsx.load` retorna um workbook vazio/undefined sem erro claro.
 * O SheetJS lida bem com essa variação. */
export async function parseGuardianWorkbook(buffer: Buffer): Promise<GuardianRawRow[]> {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const allRows: GuardianRawRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const grid: string[][] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });

    const newFormatHeaderRow = findNewFormatHeaderRow(grid);
    if (newFormatHeaderRow >= 0) {
      allRows.push(...parseNewFormatSheet(grid, newFormatHeaderRow));
      continue;
    }

    const type = SHEET_TYPES[sheetName.trim().toLowerCase()];
    if (!type) continue;

    const [headers, ...dataRows] = grid;
    if (!headers) continue;
    const cols = resolveColumns(headers);
    if (cols.guardianId < 0) continue;

    for (const row of dataRows) {
      if (row.every((c) => !c || c.trim() === "")) continue;
      const guardianId = cell(row, cols.guardianId);
      if (!guardianId) continue;

      const raw: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h && row[i]) raw[h] = row[i];
      });

      allRows.push({
        type,
        guardianId,
        categoryName: cell(row, cols.categoryName),
        description: cell(row, cols.description),
        occurredAt: combineDateTime(cell(row, cols.occurredDate), cell(row, cols.occurredTime)),
        reportedAt: combineDateTime(cell(row, cols.reportedDate), cell(row, cols.reportedTime)),
        unit: cell(row, cols.unit),
        area: cell(row, cols.area),
        subArea: cell(row, cols.subArea),
        location: cell(row, cols.location),
        equipment: cell(row, cols.equipment),
        reporterName: cell(row, cols.reporterName),
        reporterExternalId: cell(row, cols.reporterExternalId),
        reporterEmail: cell(row, cols.reporterEmail),
        reporterCompany: cell(row, cols.reporterCompany),
        isAnonymous: normalize(cell(row, cols.isAnonymous) ?? "") === "sim",
        raw,
      });
    }
  }

  return allRows;
}

export type GuardianImportRow = GuardianRawRow & {
  reporterCollaboratorId: string | null;
  reporterCollaboratorName: string | null;
  alreadyImported: boolean;
  action: "create" | "skip-not-log20" | "skip-duplicate";
};

/** Casa cada linha com um colaborador da LOG20 (por CPF, com fallback por nome) e marca quem já
 * foi importado antes (pelo `guardianId`) — só o que sobrar como "create" entra no banco. Gente
 * de outra empresa terceira na mesma exportação (Projeta, GPS, Ambev etc.) nunca casa com
 * ninguém e fica marcada "skip-not-log20", sem gravar nome/CPF dela no SIGO. */
export async function buildGuardianImportPreview(user: CurrentUser, rawRows: GuardianRawRow[]): Promise<GuardianImportRow[]> {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  const [collaborators, existing] = await Promise.all([
    db.collaborator.findMany({ select: { id: true, name: true, cpf: true } }),
    db.guardianReport.findMany({ where: { guardianId: { in: rawRows.map((r) => r.guardianId) } }, select: { guardianId: true } }),
  ]);

  const byCpf = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string }>();
  for (const c of collaborators) {
    const cpfDigits = onlyDigits(c.cpf);
    if (cpfDigits) byCpf.set(cpfDigits, c);
    byName.set(normalize(c.name), c);
  }
  const existingIds = new Set(existing.map((e) => e.guardianId));

  return rawRows.map((row) => {
    const cpfDigits = onlyDigits(row.reporterExternalId);
    const matched = (cpfDigits && byCpf.get(cpfDigits)) || (row.reporterName ? byName.get(normalize(row.reporterName)) : undefined);
    const alreadyImported = existingIds.has(row.guardianId);

    let action: GuardianImportRow["action"] = "create";
    if (alreadyImported) action = "skip-duplicate";
    else if (!matched) action = "skip-not-log20";

    return {
      ...row,
      reporterCollaboratorId: matched?.id ?? null,
      reporterCollaboratorName: matched?.name ?? null,
      alreadyImported,
      action,
    };
  });
}

/** Grava só as linhas marcadas "create" — as outras já foram filtradas no preview. */
export async function commitGuardianImport(user: CurrentUser, rows: GuardianImportRow[]): Promise<{ created: number; skipped: number }> {
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  const toCreate = rows.filter((r) => r.action === "create" && r.reporterCollaboratorId);
  if (toCreate.length === 0) return { created: 0, skipped: rows.length };

  const result = await db.guardianReport.createMany({
    data: toCreate.map((r) => ({
      guardianId: r.guardianId,
      type: r.type,
      categoryName: r.categoryName,
      description: r.description,
      occurredAt: r.occurredAt,
      reportedAt: r.reportedAt,
      unit: r.unit,
      area: r.area,
      subArea: r.subArea,
      location: r.location,
      equipment: r.equipment,
      reporterName: r.reporterName,
      reporterExternalId: r.reporterExternalId,
      reporterEmail: r.reporterEmail,
      reporterCompany: r.reporterCompany,
      reporterCollaboratorId: r.reporterCollaboratorId,
      isAnonymous: r.isAnonymous,
      raw: JSON.stringify(r.raw),
      importedById: user.id,
    })),
    skipDuplicates: true,
  });

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "GuardianImport",
    entityId: crypto.randomUUID(),
    newValue: { created: result.count, total: rows.length },
  });

  return { created: result.count, skipped: rows.length - result.count };
}
