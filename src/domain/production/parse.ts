import { PRODUCTION_FIELDS, sanitizeProductionValues, type ProductionField, type ProductionGroupKey, type ProductionValues } from "./fields";

/** Tira acento, emoji, asterisco e pontuação de enfeite; deixa minúsculo. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s:=/\-.,]/gu, " ")
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

const HELPERS_MARKERS = /area selecao|total chapas|chapa dpvim|chapas? selecionadas?|pall?tes? selecionad|dpvim pallet/;

/** O fechamento dos ajudantes (seleção/reforma) tem outro formato que o do líder: dá para reconhecer pelas expressões dele. */
export function looksLikeHelpersClosing(text: string): boolean {
  return HELPERS_MARKERS.test(plain(text));
}

/**
 * Fechamento do turno dos ajudantes (Área Seleção: Chapatex, Quadro, DPVIM pallet...). As linhas "Bom", "Reforma", "Descarte", "Transf" e "Quebra" aparecem
 * várias vezes (uma por pessoa/ordem) e são somadas; os totais ("total chapas", "pallets selecionados", "chapa dpvim") são lidos como estão.
 * Nomes de pessoas e números de ordem do DPVIM não viram campo.
 */
export function parseHelpersClosing(text: string): ParsedProductionMessage {
  const sums: Record<string, number> = {};
  const totals: Record<string, number> = {};
  let date: ParsedProductionMessage["date"] = null;
  let turno: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = plain(rawLine);
    if (!line) continue;
    if (!date && /\bdata\b/.test(line)) {
      const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(line);
      if (m) date = { day: Number(m[1]), month: Number(m[2]), year: m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null };
    }
    if (!turno) {
      const t = /\bturno\s*[:\-]?\s*([a-z0-9]{1,3})\b/.exec(line);
      if (t) turno = t[1].toUpperCase();
    }
    const m = /^([a-z][a-z ]*?)\s*[:=]\s*(-?\d+)\b/.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const value = Number(m[2]);
    if (label.startsWith("total chapa")) totals.selecaoTotalChapas = value;
    else if (label.includes("chapa") && label.includes("dpvim")) totals.selecaoChapaDpvim = value;
    else if (/chapas? selecionadas?/.test(label)) totals.selecaoChapasSelecionadas = value;
    else if (/pall?tes?|palete/.test(label) && label.includes("selecionad")) totals.selecaoPalletsSelecionados = value;
    else if (label.includes("descarte")) sums.selecaoDescarte = (sums.selecaoDescarte ?? 0) + value;
    else if (label.includes("transf")) sums.selecaoTransferencia = (sums.selecaoTransferencia ?? 0) + value;
    else if (label.includes("quebra")) sums.selecaoQuebra = (sums.selecaoQuebra ?? 0) + value;
    else if (label === "bom") sums.selecaoBom = (sums.selecaoBom ?? 0) + value;
    else if (label === "reforma") sums.selecaoReforma = (sums.selecaoReforma ?? 0) + value;
  }
  return { values: sanitizeProductionValues({ ...sums, ...totals }), notes: "", unmatched: [], date, turno };
}

/** Lê a mensagem colada, seja o relatório do líder (GERAL/CARGAS/DESCARGAS) ou o fechamento dos ajudantes (seleção). */
export function parseAnyProductionMessage(text: string): ParsedProductionMessage {
  return looksLikeHelpersClosing(text) ? parseHelpersClosing(text) : parseProductionMessage(text);
}
