/**
 * Casa o nome que vem no Guardian (muitas vezes abreviado: "LUCAS BUENO") com o colaborador do SIGO (nome completo:
 * "LUCAS BUENO DA SILVA"). Do mais seguro pro menos seguro:
 *  1. nome completo igual;
 *  2. todas as palavras do nome do Guardian aparecem, na mesma ordem, no nome do colaborador (e a primeira é a mesma);
 *  3. primeiro e último nome iguais.
 * Em cada etapa, se sobrar mais de um colaborador ativo (ou, sem nenhum ativo, mais de um no total), é AMBÍGUO: nunca
 * chuta — melhor não creditar do que creditar à pessoa errada.
 */

export type NameCandidate = { id: string; name: string; active: boolean };

export type NameMatch<T extends NameCandidate> =
  | { status: "matched"; collaborator: T; how: "exato" | "abreviado" | "primeiro-e-ultimo" }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "none" };

const PREPOSITIONS = new Set(["de", "da", "do", "das", "dos", "e"]);

function normalizeWords(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}

export function nameTokens(name: string): string[] {
  return normalizeWords(name)
    .split(/\s+/)
    .filter((t) => t && !PREPOSITIONS.has(t));
}

function isOrderedSubsequence(needle: string[], haystack: string[]): boolean {
  let i = 0;
  for (const token of haystack) {
    if (token === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

function pick<T extends NameCandidate>(candidates: T[]): { one: T | null; ambiguous: T[] } {
  if (candidates.length === 0) return { one: null, ambiguous: [] };
  if (candidates.length === 1) return { one: candidates[0], ambiguous: [] };
  // Mais de um: se só um deles é ativo, é ele (quem já saiu não deve "roubar" o relato de quem está na casa).
  const active = candidates.filter((c) => c.active);
  if (active.length === 1) return { one: active[0], ambiguous: [] };
  return { one: null, ambiguous: candidates };
}

export function matchCollaboratorByName<T extends NameCandidate>(sheetName: string, collaborators: T[]): NameMatch<T> {
  const sheet = nameTokens(sheetName);
  if (sheet.length === 0) return { status: "none" };
  const withTokens = collaborators.map((c) => ({ c, tokens: nameTokens(c.name) }));

  // 1) nome completo igual
  const exact = pick(withTokens.filter((x) => x.tokens.join(" ") === sheet.join(" ")).map((x) => x.c));
  if (exact.one) return { status: "matched", collaborator: exact.one, how: "exato" };
  if (exact.ambiguous.length) return { status: "ambiguous", candidates: exact.ambiguous };

  // Daqui pra baixo só com pelo menos 2 palavras: um primeiro nome sozinho ("LUCAS") não identifica ninguém.
  if (sheet.length < 2) return { status: "none" };

  // 2) palavras do Guardian, em ordem, dentro do nome do colaborador
  const abbreviated = pick(withTokens.filter((x) => x.tokens[0] === sheet[0] && isOrderedSubsequence(sheet, x.tokens)).map((x) => x.c));
  if (abbreviated.one) return { status: "matched", collaborator: abbreviated.one, how: "abreviado" };
  if (abbreviated.ambiguous.length) return { status: "ambiguous", candidates: abbreviated.ambiguous };

  // 3) primeiro e último nome
  const first = sheet[0];
  const last = sheet[sheet.length - 1];
  const firstLast = pick(
    withTokens.filter((x) => x.tokens.length >= 2 && x.tokens[0] === first && x.tokens[x.tokens.length - 1] === last).map((x) => x.c),
  );
  if (firstLast.one) return { status: "matched", collaborator: firstLast.one, how: "primeiro-e-ultimo" };
  if (firstLast.ambiguous.length) return { status: "ambiguous", candidates: firstLast.ambiguous };

  return { status: "none" };
}
