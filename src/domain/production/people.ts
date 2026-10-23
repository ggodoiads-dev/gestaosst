import { plain } from "./parse";

/**
 * Fechamento dos ajudantes → lançamento por pessoa. A mensagem organiza o trabalho em seções (Chapatex, Quadro, DPVIM, 5S...), e dentro delas
 * cada pessoa (ou dupla/equipe) tem seus números: "Stefany:2000 / Quebra:2", "Andrei / Bom:250 / Reforma:50", "Jean/Bernardo / Bom:135...".
 * O que sai daqui é só uma PROPOSTA que a tela mostra para conferir antes de gravar.
 */

export type PeopleSection = "chapatex" | "quadro" | "dpvim" | "bulks" | "5s" | "armazem";

export type HelperRef = { id: string; name: string };

export type PeopleEntry = {
  section: PeopleSection;
  /** Quem fez o bloco. `candidateIds` com mais de um = nome ambíguo (ex.: "Jean"); vazio = não achei ninguém. */
  people: { text: string; candidateIds: string[] }[];
  /** Quantidade do bloco (a soma das pessoas dele): o número da linha da pessoa, ou Bom + Reforma. `null` = só registrar que fez (5S). */
  quantity: number | null;
  details: { bom?: number; reforma?: number; descarte?: number; quebra?: number; transf?: number };
};

export type ParsedPeople = { entries: PeopleEntry[]; unrecognized: string[] };

const SECTION_HEADERS: { re: RegExp; key: PeopleSection | "ignore" | "end" }[] = [
  { re: /^total\b/, key: "end" },
  { re: /^area selecao\b/, key: "ignore" },
  { re: /^qlp\b/, key: "ignore" },
  { re: /^retrabalho\b/, key: "ignore" },
  { re: /^quedas?\b/, key: "ignore" },
  { re: /^area reforma\b/, key: "ignore" },
  { re: /^chapatex\b/, key: "chapatex" },
  { re: /^quadros?\b/, key: "quadro" },
  { re: /^dpvi[mn]\b/, key: "dpvim" },
  { re: /^bulks?\b/, key: "bulks" },
  { re: /^5 ?s\b/, key: "5s" },
  { re: /^armazem\b/, key: "armazem" },
];

const DETAIL_RE = /^(bom|reforma|pallets? descarte|descarte|chapas? transferencia|transferencia|transf|chapas? quebradas?|quebra|oi)\s*[:=]\s*(-?\d+)\b/;

function detailKey(label: string): keyof PeopleEntry["details"] | "oi" {
  if (label === "bom") return "bom";
  if (label === "reforma") return "reforma";
  if (label.includes("descarte")) return "descarte";
  if (label.includes("transf")) return "transf";
  if (label.includes("quebra")) return "quebra";
  return "oi";
}

/** Tira emoji, asterisco e aspas, mas mantém acento e maiúsculas (para mostrar o nome como veio). */
function clean(line: string): string {
  return line.replace(/[^\p{L}\p{N}\s:=/\-.,]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Quem pode ser o ajudante citado: todos os pedaços do nome citado precisam bater (por inteiro ou pelo começo) com pedaços do nome cadastrado. */
export function matchHelpers(text: string, helpers: HelperRef[]): string[] {
  const tokens = plain(text).split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  return helpers
    .filter((h) => {
      const parts = plain(h.name).split(/\s+/);
      return tokens.every((t) => parts.some((p) => p === t || (t.length >= 3 && p.startsWith(t))));
    })
    .map((h) => h.id);
}

function splitNames(line: string): string[] {
  return line
    .split(/[/,]|\s+e\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseHelpersPeople(text: string, helpers: HelperRef[]): ParsedPeople {
  const entries: PeopleEntry[] = [];
  const unrecognized: string[] = [];

  let section: PeopleSection | "ignore" | "end" | null = null;
  let names: PeopleEntry["people"] = [];
  let namesOpen = true;
  let quantity: number | null = null;
  let details: PeopleEntry["details"] = {};
  let hasDetails = false;

  function flush(force = false) {
    if (section && section !== "ignore" && section !== "end") {
      const wantsPeopleOnly = section === "5s" || section === "armazem";
      if (hasDetails || quantity !== null || (force && wantsPeopleOnly && names.length > 0)) {
        const q = quantity ?? (details.bom !== undefined || details.reforma !== undefined ? (details.bom ?? 0) + (details.reforma ?? 0) : null);
        entries.push({ section, people: names.length > 0 ? names : [{ text: "", candidateIds: [] }], quantity: q, details });
      }
    }
    quantity = null;
    details = {};
    hasDetails = false;
    namesOpen = true;
  }

  for (const raw of text.split(/\r?\n/)) {
    const shown = clean(raw);
    const line = plain(raw);
    if (!line) {
      if (hasDetails || quantity !== null) flush();
      continue;
    }
    const header = SECTION_HEADERS.find((h) => h.re.test(line));
    if (header) {
      const same = header.key === section;
      flush(true);
      section = header.key;
      if (section === "end") break;
      if (!same) names = [];
      namesOpen = true;
      continue;
    }
    if (section === null || section === "ignore") continue;

    const detail = DETAIL_RE.exec(line);
    if (detail) {
      const key = detailKey(detail[1]);
      if (key !== "oi") details[key] = (details[key] ?? 0) + Number(detail[2]);
      hasDetails = true;
      continue;
    }

    const named = /^([a-z][a-z ]*?)\s*[:=]\s*(\d+)$/.exec(line);
    if (named) {
      // "Stefany:2000": a pessoa e o número dela, na mesma linha.
      if (hasDetails || quantity !== null) flush();
      const label = shown.split(/[:=]/)[0].trim();
      const ids = matchHelpers(label, helpers);
      if (ids.length === 0) {
        unrecognized.push(shown);
        continue;
      }
      names = [{ text: label, candidateIds: ids }];
      namesOpen = false;
      quantity = Number(named[2]);
      continue;
    }

    if (/\d/.test(line) || /[:=]/.test(line)) continue; // número de ordem, código... não é nome

    // Linha só com nome(s): "Andrei", "Jean/Bernardo", "Everton". Só vale se bater com algum ajudante cadastrado.
    if (hasDetails || quantity !== null) flush();
    const found = splitNames(shown).map((t) => ({ text: t, candidateIds: matchHelpers(t, helpers) }));
    const known = found.filter((f) => f.candidateIds.length > 0);
    if (known.length === 0) {
      unrecognized.push(shown);
      continue;
    }
    if (namesOpen) {
      names = [];
      namesOpen = false;
    }
    names.push(...known);
  }
  flush(true);

  return { entries, unrecognized: [...new Set(unrecognized)] };
}

/** Divide a quantidade do bloco entre as pessoas (a sobra vai para as primeiras). */
export function shareQuantity(quantity: number | null, count: number): (number | null)[] {
  if (quantity === null || count <= 0) return Array.from({ length: Math.max(count, 1) }, () => null);
  const base = Math.floor(quantity / count);
  const rest = quantity - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Atividade sugerida para a seção, pelo nome da atividade cadastrada. */
export function suggestActivityId(section: PeopleSection, activities: { id: string; name: string }[]): string {
  const norm = (a: { name: string }) => plain(a.name);
  const pick = (pred: (n: string) => boolean) => activities.find((a) => pred(norm(a)))?.id ?? "";
  switch (section) {
    case "chapatex":
      return pick((n) => n.includes("chapatex") && !n.includes("dpvi"));
    case "quadro":
      return pick((n) => n.includes("quadro"));
    case "dpvim":
      return pick((n) => n.includes("dpvi"));
    case "bulks":
      return pick((n) => n.includes("bulk"));
    case "5s":
    case "armazem":
      return pick((n) => /\b5 ?s\b/.test(n));
  }
}

export const SECTION_LABELS: Record<PeopleSection, string> = {
  chapatex: "Chapatex",
  quadro: "Quadro",
  dpvim: "DPVIM",
  bulks: "Bulks",
  "5s": "5S",
  armazem: "Armazém",
};

/** Texto que vai nas observações do lançamento da pessoa. */
export function detailsNote(entry: PeopleEntry, sharedWith: number): string {
  const parts: string[] = [];
  const d = entry.details;
  if (d.bom !== undefined) parts.push(`Bom ${d.bom}`);
  if (d.reforma !== undefined) parts.push(`Reforma ${d.reforma}`);
  if (d.descarte !== undefined) parts.push(`Descarte ${d.descarte}`);
  if (d.quebra !== undefined) parts.push(`Quebra ${d.quebra}`);
  if (d.transf !== undefined) parts.push(`Transferência ${d.transf}`);
  const base = parts.length > 0 ? `Fechamento do turno: ${parts.join(", ")}` : "Fechamento do turno";
  return sharedWith > 1 ? `${base} (total da equipe de ${sharedWith}, dividido igualmente)` : base;
}
