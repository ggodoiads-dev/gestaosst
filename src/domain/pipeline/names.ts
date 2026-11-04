/**
 * Correlação de nomes entre a planilha (nomes curtos, "Endryk Matheus") e o cadastro (nome completo, "ENDRYK MATHEUS RODRIGUES"). Dois nomes combinam quando
 * o mais curto tem pelo menos duas palavras, começa pela mesma palavra e todas as suas palavras aparecem no mais longo (sem contar "de", "da", "dos"...).
 */
const STOP = new Set(["de", "da", "do", "das", "dos", "e"]);

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));
}

export function namesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 1) return ta.join(" ") === tb.join(" ");
  return short[0] === long[0] && short.every((t) => long.includes(t));
}

/** O único colaborador que combina com o nome; com mais de um, só se algum tiver exatamente as mesmas palavras. `null` se não há ou se é ambíguo. */
export function uniqueMatch<T extends { name: string }>(name: string, people: T[]): T | null {
  const hits = people.filter((p) => namesMatch(name, p.name));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const exact = hits.filter((p) => nameTokens(p.name).join(" ") === nameTokens(name).join(" "));
    if (exact.length === 1) return exact[0];
  }
  return null;
}
