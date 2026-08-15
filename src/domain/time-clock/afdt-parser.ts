import { fromZonedTime } from "date-fns-tz";

/**
 * Parser do arquivo AFDT (Portaria 671/2021) — layout de largura fixa decodificado
 * empiricamente a partir de um arquivo real, posição por posição:
 *
 *   NSR(9) + tipo(1) + data DDMMAAAA(8) + hora HHMM(4) + PIS(11) + metadados fixos
 *   do REP(18, não usados aqui) + tipo de marcação E/S(1) + nº da marcação(2) +
 *   origem O/I(1) + quando origem="I", motivo em texto livre até o fim da linha.
 *
 * Só o registro tipo "2" (marcação de ponto) é relevante aqui — cabeçalho (tipo "1")
 * e rodapé (tipo "9") são ignorados, assim como qualquer outro tipo de registro.
 */

const AFDT_TIMEZONE = "America/Sao_Paulo";
const MARK_RECORD_TYPE = "2";
const MIN_MARK_LINE_LENGTH = 55;

export type TimeClockMarkType = "ENTRADA" | "SAIDA";
export type TimeClockOrigin = "ORIGINAL" | "MANUAL";

export type ParsedTimeClockMark = {
  nsr: number;
  pis: string;
  timestamp: Date;
  markType: TimeClockMarkType;
  markNumber: number;
  origin: TimeClockOrigin;
  reason: string | null;
};

export type ParsedAfdt = {
  marks: ParsedTimeClockMark[];
  ignoredLines: number;
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseMarkLine(line: string): ParsedTimeClockMark | null {
  if (line.length < MIN_MARK_LINE_LENGTH) return null;

  const nsr = Number(line.slice(0, 9));
  const day = Number(line.slice(10, 12));
  const month = Number(line.slice(12, 14));
  const year = Number(line.slice(14, 18));
  const hour = Number(line.slice(18, 20));
  const minute = Number(line.slice(20, 22));
  const pis = line.slice(22, 33);
  const eventChar = line.slice(51, 52);
  const markNumber = Number(line.slice(52, 54));
  const originChar = line.slice(54, 55);
  const reason = line.length > 55 ? line.slice(55).trim() : "";

  if (![nsr, day, month, year, hour, minute, markNumber].every((n) => Number.isFinite(n))) return null;
  if (eventChar !== "E" && eventChar !== "S") return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const timestamp = fromZonedTime(new Date(year, month - 1, day, hour, minute, 0), AFDT_TIMEZONE);

  return {
    nsr,
    pis,
    timestamp,
    markType: eventChar === "E" ? "ENTRADA" : "SAIDA",
    markNumber,
    origin: originChar === "O" ? "ORIGINAL" : "MANUAL",
    reason: reason || null,
  };
}

export function parseAfdt(rawText: string): ParsedAfdt {
  const text = stripBom(rawText);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");

  const marks: ParsedTimeClockMark[] = [];
  let ignoredLines = 0;

  for (const line of lines) {
    const recordType = line.slice(9, 10);
    if (recordType !== MARK_RECORD_TYPE) continue;

    const mark = parseMarkLine(line);
    if (mark) marks.push(mark);
    else ignoredLines++;
  }

  return { marks, ignoredLines };
}
