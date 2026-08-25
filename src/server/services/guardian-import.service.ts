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

/** Lê as 4 abas conhecidas do export do Guardian. Abas ausentes ou com nome diferente são
 * simplesmente ignoradas (não é erro — algumas exportações podem vir sem alguma aba se não
 * houve relato daquele tipo no período).
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
    const type = SHEET_TYPES[sheetName.trim().toLowerCase()];
    if (!type) continue;

    const sheet = workbook.Sheets[sheetName];
    const grid: string[][] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
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
