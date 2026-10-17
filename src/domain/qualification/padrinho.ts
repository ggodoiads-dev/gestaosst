/** Qualificação "Padrinho" — a Trilha de Treinamento para Padrinhos (feita em outra plataforma da companhia). Sem validade. */
export const PADRINHO_TYPE_NAME = "Padrinho — Trilha de Treinamento para Padrinhos";
export const PADRINHO_TYPE_ALIASES = ["Padrinho", "Padrinhos", "Trilha de Treinamento para Padrinhos", "Trilha para Padrinhos"];

/** Reconhece o tipo de qualificação "Padrinho" pelo nome (qualquer variação que tenha "padrinho"). */
export function isPadrinhoQualification(typeName: string): boolean {
  return typeName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .includes("padrinho");
}
