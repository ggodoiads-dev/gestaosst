/**
 * Parser do arquivo AEJ (Portaria 671/2021, Anexo IV — Arquivo Eletrônico de Jornada) — formato
 * mais rico que o AFD: texto delimitado por "|", com registro tipo "03" trazendo matrícula+CPF+
 * nome do colaborador, e tipo "05" trazendo cada marcação de ponto já identificada pela mesma
 * matrícula (não pelo PIS). Decodificado a partir de um arquivo real de exportação (DIMEP Kairos).
 *
 * Layout do registro "05":
 *   05|matrícula|timestamp ISO 8601 com fuso|sequencial|E ou S|nº da marcação|O ou I (origem)|...
 */

export type TimeClockMarkType = "ENTRADA" | "SAIDA";
export type TimeClockOrigin = "ORIGINAL" | "MANUAL";

export type ParsedAejMark = {
  /** Na prática é a matrícula, não o PIS — o campo se chama `pis` só pra reaproveitar o mesmo
   * formato de `ParsedTimeClockMark` (afdt-parser.ts) e todo o pipeline de importação/reconciliação. */
  pis: string;
  timestamp: Date;
  markType: TimeClockMarkType;
  markNumber: number;
  origin: TimeClockOrigin;
  reason: string | null;
};

export type ParsedAej = {
  marks: ParsedAejMark[];
  ignoredLines: number;
};

const MARK_RECORD_PREFIX = "05|";

function parseMarkLine(line: string): ParsedAejMark | null {
  const parts = line.split("|");
  if (parts.length < 7) return null;

  const matricula = parts[1]?.trim();
  const timestamp = parts[2] ? new Date(parts[2]) : null;
  const markTypeChar = parts[4];
  const markNumber = Number(parts[5]);
  const originChar = parts[6];

  if (!matricula) return null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) return null;
  if (markTypeChar !== "E" && markTypeChar !== "S") return null;
  if (!Number.isFinite(markNumber)) return null;

  return {
    pis: matricula,
    timestamp,
    markType: markTypeChar === "E" ? "ENTRADA" : "SAIDA",
    markNumber,
    origin: originChar === "O" ? "ORIGINAL" : "MANUAL",
    reason: null,
  };
}

export function parseAej(rawText: string): ParsedAej {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim() !== "");

  const marks: ParsedAejMark[] = [];
  let ignoredLines = 0;

  for (const line of lines) {
    if (!line.startsWith(MARK_RECORD_PREFIX)) continue;
    const mark = parseMarkLine(line);
    if (mark) marks.push(mark);
    else ignoredLines++;
  }

  return { marks, ignoredLines };
}
