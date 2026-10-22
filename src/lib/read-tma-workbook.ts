import type * as XLSXNamespace from "xlsx";
import { periodKeyFromSheetName } from "@/domain/tma/parse";

type XLSXLib = typeof XLSXNamespace;
type Source = { data: ArrayBuffer | Uint8Array | Buffer; type: "array" | "buffer" };

/** Abas mensais ("TMA OUT-26") do arquivo, sem carregar as células (rápido, mesmo com o arquivo de 5 MB). */
export function listTmaMonthSheets(XLSX: XLSXLib, source: Source): { name: string; periodKey: string }[] {
  const wb = XLSX.read(source.data, { type: source.type, bookSheets: true });
  return wb.SheetNames.flatMap((name) => {
    const periodKey = periodKeyFromSheetName(name);
    return periodKey ? [{ name, periodKey }] : [];
  }).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

/** Lê só as abas pedidas e devolve cada uma como matriz de células, cortada na última linha que tem dado: as abas da Ambev
 * têm formatação até a linha 1.048.576, e ler tudo isso travaria o navegador. Datas e horas vêm como número serial do Excel. */
export function readTmaGrids(XLSX: XLSXLib, source: Source, sheetNames: string[]): Map<string, unknown[][]> {
  const wb = XLSX.read(source.data, { type: source.type, sheets: sheetNames, cellDates: false, cellFormula: false, cellStyles: false, cellHTML: false });
  const grids = new Map<string, unknown[][]>();
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    let maxRow = 0;
    let maxCol = 0;
    for (const key of Object.keys(ws)) {
      if (key.startsWith("!")) continue;
      const cell = ws[key] as { v?: unknown };
      if (cell.v === undefined || cell.v === "" || cell.v === null) continue;
      const { r, c } = XLSX.utils.decode_cell(key);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
    grids.set(name, XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }));
  }
  return grids;
}
