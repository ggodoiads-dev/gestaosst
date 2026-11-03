/**
 * Agrupa as ações de DTO que são a mesma tarefa para pessoas diferentes ("Verificar treinamento de paleteira" × 4 colaboradores).
 * O Rico escreve o título de cada ação por conta própria, então o mesmo assunto sai com verbos e palavras diferentes ("Confirmar treinamento
 * recente em paleteira", "Verificar qualificação em paleteira"). A chave tira o que não muda o assunto: acentos, verbos de checagem,
 * artigos e adjetivos de tempo; e trata sinônimos (qualificação, capacitação, curso) como treinamento.
 */
const STOP = new Set(["a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "para", "por", "e", "com", "ao", "aos", "um", "uma", "se", "que", "ja", "sobre"]);
const CHECK_VERBS = new Set(["verificar", "confirmar", "checar", "conferir", "validar", "revisar", "comprovar", "garantir", "assegurar", "certificar", "consultar", "buscar", "levantar", "analisar", "avaliar"]);
const FILLER = new Set(["recente", "recentes", "atual", "atuais", "ultimo", "ultimos", "ano", "anos", "registro", "registros", "sistema", "colaborador", "colaboradora", "ajudante", "funcionario", "funcionaria", "pessoa", "possui", "possuir", "tem", "ter", "passou", "realizou", "feito"]);
const SYNONYMS: Record<string, string> = {
  qualificacao: "treinamento",
  qualificar: "treinamento",
  capacitacao: "treinamento",
  capacitar: "treinamento",
  curso: "treinamento",
  cursos: "treinamento",
  treinamentos: "treinamento",
  reciclagem: "treinamento",
  habilitacao: "treinamento",
  orientar: "orientacao",
  orientacoes: "orientacao",
};

const fold = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase();

export function actionGroupKey(title: string): string {
  const tokens = fold(title)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && !CHECK_VERBS.has(t) && !FILLER.has(t))
    .map((t) => SYNONYMS[t] ?? t);
  const key = [...new Set(tokens)].sort().join(" ");
  // Título que só tinha palavras "neutras" não pode virar chave vazia (juntaria tudo): usa o título inteiro.
  return key || fold(title).replace(/\s+/g, " ").trim();
}

/** Junta por chave, mantendo a ordem do primeiro aparecimento de cada grupo. */
export function groupByAction<T extends { title: string }>(rows: T[]): { key: string; title: string; rows: T[] }[] {
  const map = new Map<string, { key: string; title: string; rows: T[] }>();
  for (const r of rows) {
    const key = actionGroupKey(r.title);
    const g = map.get(key);
    if (g) g.rows.push(r);
    else map.set(key, { key, title: r.title, rows: [r] });
  }
  return [...map.values()];
}
