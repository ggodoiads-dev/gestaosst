import { PRODUCTION_FIELDS, sanitizeProductionValues, type ProductionField, type ProductionGroupKey, type ProductionValues } from "./fields";

/** Tira acento, emoji, asterisco e pontuação de enfeite; deixa minúsculo. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s:/\-.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const SECTIONS: Record<string, ProductionGroupKey | "OBS"> = {
  geral: "GERAL",
  cargas: "CARGAS",
  carga: "CARGAS",
  descargas: "DESCARGAS",
  descarga: "DESCARGAS",
  observacoes: "OBS",
  observacao: "OBS",
  obs: "OBS",
};

function findField(label: string, section: ProductionGroupKey): ProductionField | undefined {
  const candidates = PRODUCTION_FIELDS.filter((f) => f.group === section);
  const norm = plain(label);
  return candidates.find((f) => plain(f.label) === norm || (f.aliases ?? []).includes(norm));
}

export type ParsedProductionMessage = {
  values: ProductionValues;
  notes: string;
  /** Linhas "Rótulo: número" que não bateram com nenhum campo (para avisar quem colou). */
  unmatched: string[];
  /** Data e turno que aparecem no cabeçalho da mensagem, se houver. */
  date: { day: number; month: number; year: number | null } | null;
  turno: string | null;
};

/** Lê a mensagem de fim de turno colada do WhatsApp (GERAL / CARGAS / DESCARGAS / OBSERVAÇÕES) e preenche os campos. */
export function parseProductionMessage(text: string): ParsedProductionMessage {
  const values: ProductionValues = {};
  const unmatched: string[] = [];
  const notesLines: string[] = [];
  let section: ProductionGroupKey | "OBS" | null = null;
  let date: ParsedProductionMessage["date"] = null;
  let turno: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = plain(rawLine);
    if (!line) {
      if (section === "OBS" && notesLines.length > 0) notesLines.push("");
      continue;
    }

    const asHeader = SECTIONS[line.replace(/[:\-.\s]+$/g, "").trim()];
    if (asHeader) {
      section = asHeader;
      continue;
    }
    // "Observações: texto na mesma linha"
    const obsInline = /^(observacoes|observacao|obs)\s*:\s*(.+)$/.exec(line);
    if (obsInline) {
      section = "OBS";
      notesLines.push(rawLine.replace(/^[^:]*:\s*/, "").replace(/\*/g, "").trim());
      continue;
    }

    if (section === "OBS") {
      notesLines.push(rawLine.replace(/\*/g, "").trim());
      continue;
    }

    if (section === null) {
      // Cabeçalho da mensagem: data e turno, se vierem.
      if (!date) {
        const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(line);
        if (m) {
          const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
          date = { day: Number(m[1]), month: Number(m[2]), year };
        }
      }
      if (!turno) {
        const t = /\bturno\s*[:\-]?\s*([a-z0-9]{1,3})\b/.exec(line);
        if (t) turno = t[1].toUpperCase();
      }
    }

    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const label = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    const field = findField(label, section ?? "GERAL");
    const numberMatch = /-?\d+/.exec(rest);
    if (!field) {
      if (numberMatch && label) unmatched.push(rawLine.replace(/\*/g, "").trim());
      continue;
    }
    if (!numberMatch) continue;
    values[field.key] = Number(numberMatch[0]);
  }

  while (notesLines.length > 0 && notesLines[notesLines.length - 1] === "") notesLines.pop();
  return { values: sanitizeProductionValues(values), notes: notesLines.join("\n").trim(), unmatched, date, turno };
}
