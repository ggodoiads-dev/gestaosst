/** Agrupa quem é de cada função na ficha pública da área: primeiro amarradores, depois operadores, depois as demais funções
 * (em ordem alfabética) e, por último, quem está sem função. */
export function functionGroupRank(functionName: string | null): number {
  if (!functionName) return 3;
  const n = functionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("amarrad")) return 0;
  if (n.includes("operador")) return 1;
  return 2;
}

export function groupByFunction<T>(entries: T[], getFunctionName: (entry: T) => string | null): { functionName: string | null; entries: T[] }[] {
  const groups = new Map<string, { functionName: string | null; entries: T[] }>();
  for (const entry of entries) {
    const name = getFunctionName(entry);
    const key = name ?? "";
    const group = groups.get(key) ?? { functionName: name, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      functionGroupRank(a.functionName) - functionGroupRank(b.functionName) ||
      (a.functionName ?? "").localeCompare(b.functionName ?? "", "pt-BR"),
  );
}
