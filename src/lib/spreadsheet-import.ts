import ExcelJS from "exceljs";

export type ParsedSheet = { headers: string[]; rows: string[][] };

/** Formato numérico "hora pura" (sem parte de data) — ex: "h:mm AM/PM", "HH:mm:ss". Excel/ExcelJS
 * guarda esse tipo de célula como Date com a data-base 1899/1900 (herdado do Lotus 1-2-3); só a
 * hora é significativa. Distingue pelo padrão de formatação em vez do valor, que é mais confiável
 * que checar o ano (o "ano zero" do Excel varia por regionalização). */
function isTimeOnlyFormat(numFmt: string | undefined): boolean {
  if (!numFmt) return false;
  const fmt = numFmt.toLowerCase();
  // "h"/"s" só aparecem em formato de hora; "m" é ambíguo (minuto perto de h/s, mês perto de d/y),
  // por isso não entra na checagem — só "y"/"d" são indicadores de data sem ambiguidade.
  const hasTimeMarker = /[hs]/.test(fmt);
  const hasDateMarker = /[yd]/.test(fmt);
  return hasTimeMarker && !hasDateMarker;
}

function cellToString(v: ExcelJS.CellValue, numFmt?: string): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (isTimeOnlyFormat(numFmt)) {
      // ExcelJS constrói esse Date a partir do número serial assumindo UTC (Excel não guarda fuso
      // horário) — ler em UTC evita que o fuso local desloque a hora certa.
      const hh = String(v.getUTCHours()).padStart(2, "0");
      const min = String(v.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${min}`;
    }
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
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      // Célula mesclada (comum em planilhas de RH pra agrupar categoria/tipo em várias linhas):
      // só a célula do topo/esquerda da mesclagem carrega o valor real, as outras ficam vazias.
      const source = cell.isMerged && cell.master ? cell.master : cell;
      values.push(cellToString(source.value, source.numFmt));
    });
    allRows.push(values);
  });

  const [headers, ...dataRows] = allRows;
  return { headers: headers ?? [], rows: dataRows };
}

/** Remove acentos (via decomposição NFD + descarte dos marcadores combinantes, codepoint 0x0300+) e normaliza pra comparação de cabeçalhos. */
export function normalize(s: string): string {
  return Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Sugere o mapeamento de colunas casando o cabeçalho normalizado com apelidos conhecidos por campo. */
export function suggestMapping<F extends string>(
  headers: string[],
  fields: readonly F[],
  aliases: Record<F, string[]>,
): Partial<Record<F, number>> {
  const result: Partial<Record<F, number>> = {};
  const normalizedHeaders = headers.map(normalize);
  for (const field of fields) {
    const fieldAliases = aliases[field];
    const idx = normalizedHeaders.findIndex((h) => fieldAliases.some((a) => h === a || h.includes(a)));
    if (idx >= 0) result[field] = idx;
  }
  return result;
}

export function getCell<F extends string>(
  row: string[],
  mapping: Partial<Record<F, number>>,
  field: F,
): string | null {
  const idx = mapping[field];
  if (idx === undefined || idx === null) return null;
  const raw = row[idx];
  return raw && raw.trim() !== "" ? raw.trim() : null;
}

export function parseDateCell(raw: string | null): Date | null {
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12);
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}
