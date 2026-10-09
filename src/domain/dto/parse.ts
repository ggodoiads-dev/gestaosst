import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import { classifyAnswer, normalizeText, summarizeAnswers, type DtoAnswer } from "./answers";

export { classifyAnswer, normalizeText, summarizeAnswers };
export type { DtoAnswer };

/** DTO (observação de comportamento/atividade) exportado do DMPeople: uma linha por avaliação, com as 11 primeiras
 * colunas de identificação e, a partir daí, uma coluna por pergunta de TODOS os formulários (cada linha só tem as
 * colunas do formulário da sua "Atividade" preenchidas). */

export type DtoRawRow = {
  externalKey: string;
  date: Date;
  evaluatedName: string;
  evaluatedRole: string | null;
  evaluatorName: string | null;
  evaluatorRole: string | null;
  leaderName: string | null;
  company: string | null;
  operation: string | null;
  activity: string;
  answers: DtoAnswer[];
  yesCount: number;
  noCount: number;
  naCount: number;
  scorePercent: number | null;
};

const FIRST_QUESTION_COLUMN = 11;

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/�/g, "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** Data da avaliação como meio-dia UTC do dia de calendário (evita o dia "voltar" por fuso). */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SheetJS (cellDates) devolve o instante já ajustado ao fuso local; o dia de calendário é o local.
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12));
  }
  const text = clean(value);
  if (!text) return null;
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12));
  return null;
}

export function dtoExternalKey(parts: { date: Date; evaluated: string; activity: string; evaluator: string | null }): string {
  const key = [parts.date.toISOString().slice(0, 10), normalizeText(parts.evaluated), normalizeText(parts.activity), normalizeText(parts.evaluator ?? "")].join("|");
  return createHash("sha1").update(key).digest("hex");
}

export function parseDtoWorkbook(buffer: Buffer): DtoRawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headerIdx = grid.findIndex((row) => {
    const joined = row.slice(0, 4).map((c) => normalizeText(String(c ?? "")));
    return joined[0] === "data" && joined[1] === "colaborador" && joined.includes("avaliador");
  });
  if (headerIdx < 0) return [];

  const headers = grid[headerIdx].map((h) => clean(h));
  const col = (name: string) => headers.findIndex((h) => h && normalizeText(h) === normalizeText(name));
  const idx = {
    date: col("Data"),
    evaluated: col("Colaborador"),
    role: col("Cargo"),
    evaluator: col("Avaliador"),
    evaluatorRole: col("Cargo Avaliador"),
    leader: col("Lider"),
    company: col("Empresa"),
    operation: col("Operação"),
    activity: col("Atividade"),
  };
  if (idx.date < 0 || idx.evaluated < 0 || idx.activity < 0) return [];

  const rows: DtoRawRow[] = [];
  for (const raw of grid.slice(headerIdx + 1)) {
    const evaluatedName = clean(raw[idx.evaluated]);
    const activity = clean(raw[idx.activity]);
    const date = parseDate(raw[idx.date]);
    // Rodapé do export ("Filtros aplicados...") e linhas em branco não têm colaborador/atividade/data válidos.
    if (!evaluatedName || !activity || !date) continue;

    const answers: DtoAnswer[] = [];
    for (let i = FIRST_QUESTION_COLUMN; i < headers.length; i++) {
      const q = headers[i];
      const a = clean(raw[i]);
      if (q && a) answers.push({ q, a });
    }
    const evaluatorName = clean(raw[idx.evaluator]);
    rows.push({
      externalKey: dtoExternalKey({ date, evaluated: evaluatedName, activity, evaluator: evaluatorName }),
      date,
      evaluatedName,
      evaluatedRole: clean(raw[idx.role]),
      evaluatorName,
      evaluatorRole: clean(raw[idx.evaluatorRole]),
      leaderName: clean(raw[idx.leader]),
      company: clean(raw[idx.company]),
      operation: clean(raw[idx.operation]),
      activity,
      answers,
      ...(() => {
        const s = summarizeAnswers(answers);
        return { yesCount: s.yes, noCount: s.no, naCount: s.na, scorePercent: s.scorePercent };
      })(),
    });
  }
  return rows;
}
