/** A produtividade por pessoa (lançamentos por atividade) vale só para os ajudantes de armazém; o resto da produção é lançado por turno. */
export function isWarehouseHelper(collaborator: { cargo: string | null }): boolean {
  return /ajudante|reformador/i.test(collaborator.cargo ?? "");
}

/** Algumas atividades têm no campo "unidade" o nome do cliente ou uma frase ("VIDROS PARANÁ"): só mostra como unidade se for curta (pallets, un, kg...). */
export function displayUnit(unit: string | null | undefined): string | null {
  const u = unit?.trim();
  return u && u.length <= 12 ? u : null;
}

/**
 * A atividade se mede por quantidade? Pela regra de sempre do cadastro: tem "unidade de produção" = mede quantidade; sem unidade = só conta as vezes que foi
 * feita. O 5S nunca é medido por quantidade, mesmo que o cadastro tenha texto solto no campo unidade (veio assim da importação).
 */
export function measuresQuantity(activity: { name: string; unit: string | null | undefined }): boolean {
  if (/^\s*5 ?s\b/i.test(activity.name)) return false;
  return !!activity.unit?.trim();
}
