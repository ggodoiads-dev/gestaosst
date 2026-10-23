/** A produtividade por pessoa (lançamentos por atividade) vale só para os ajudantes de armazém; o resto da produção é lançado por turno. */
export function isWarehouseHelper(collaborator: { cargo: string | null }): boolean {
  return /ajudante/i.test(collaborator.cargo ?? "");
}

/** Algumas atividades têm no campo "unidade" o nome do cliente ou uma frase ("VIDROS PARANÁ"): só mostra como unidade se for curta (pallets, un, kg...). */
export function displayUnit(unit: string | null | undefined): string | null {
  const u = unit?.trim();
  return u && u.length <= 12 ? u : null;
}
