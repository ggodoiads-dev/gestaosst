/**
 * Acesso restrito por abas (usado no perfil Auditor): em vez de ver tudo o que o perfil permite, o usuário vê só as abas (itens do menu) que o
 * administrador marcou. Sem nenhuma aba guardada = sem restrição (o comportamento de sempre).
 */

/** Sempre liberadas para quem tem restrição: a tela inicial e os termos de uso. */
export const ALWAYS_ALLOWED_HREFS = ["/inicio", "/termos-de-uso"] as const;

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** O item do menu que "dono" do caminho: o de href mais longo que bate (ex.: /financeiro/dre é do item DRE, não do Financeiro). */
export function owningHref(pathname: string, knownHrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of knownHrefs) {
    if (matches(pathname, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** O caminho pode ser aberto por quem tem restrição? Só se o item do menu dono dele estiver marcado (ou for tela sempre liberada). */
export function isPathAllowed(pathname: string, allowed: ReadonlySet<string>, knownHrefs: readonly string[]): boolean {
  if (ALWAYS_ALLOWED_HREFS.some((h) => matches(pathname, h))) return true;
  const owner = owningHref(pathname, knownHrefs);
  return owner !== null && allowed.has(owner);
}

/** Deixa no menu só os itens marcados (e os sempre liberados); grupo que ficar vazio some. */
export function filterNavGroups<G extends { items: { href: string }[] }>(groups: G[], allowed: ReadonlySet<string>): G[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.href) || (ALWAYS_ALLOWED_HREFS as readonly string[]).includes(i.href)) }))
    .filter((g) => g.items.length > 0);
}
