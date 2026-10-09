const LOWER_WORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** "CLAUDIO ANTUNES DA ROSA" → "Claudio Antunes da Rosa" (só pra exibir; não altera o cadastro). */
export function formatPersonName(name: string): string {
  return name
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((word, i) => (i > 0 && LOWER_WORDS.has(word) ? word : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1)))
    .join(" ");
}

export function initials(name: string): string {
  const parts = name.split(/\s+/).filter((p) => !LOWER_WORDS.has(p.toLocaleLowerCase("pt-BR")));
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("pt-BR");
}
