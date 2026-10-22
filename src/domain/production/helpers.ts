/** A produtividade por pessoa (lançamentos por atividade) vale só para os ajudantes de armazém; o resto da produção é lançado por turno. */
export function isWarehouseHelper(collaborator: { cargo: string | null }): boolean {
  return /ajudante/i.test(collaborator.cargo ?? "");
}
