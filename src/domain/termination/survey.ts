/**
 * Resumo das entrevistas de desligamento vindo de uma plataforma externa: tabelas já agregadas (sem uma linha por pessoa). Dois formatos:
 * motivo da saída × tempo de casa (em %), e satisfação por categoria com % de itens críticos. Entram no PDCA como leitura externa, separada das entrevistas por pessoa.
 */
export type SurveyKind = "MOTIVOS_TEMPO" | "SATISFACAO";

export type MotivosTempo = { buckets: string[]; rows: { motivo: string; values: (number | null)[] }[] };
export type Satisfacao = { rows: { categoria: string; satisfacao: number | null; criticos: number | null }[]; total: { satisfacao: number | null; criticos: number | null } | null };

export type ParsedSurvey = { kind: "MOTIVOS_TEMPO"; data: MotivosTempo } | { kind: "SATISFACAO"; data: Satisfacao };

const squash = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** "0.2923" → 29.2; "29,2" → 29.2; vazio ou texto → null. Valor até 1 é fração; acima disso já está em %. */
export function parsePercent(text: string | null | undefined): number | null {
  if (text === null || text === undefined || String(text).trim() === "") return null;
  const n = Number(String(text).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round((n <= 1 ? n * 100 : n) * 10) / 10;
}

const isEnd = (cell: string | undefined) => !cell || cell.trim() === "" || squash(cell).startsWith("filtros");

export function parseSurvey(headers: string[], rows: string[][]): ParsedSurvey | { error: string } {
  const first = squash(headers[0] ?? "");
  if (first === "tempodecasa") {
    const buckets = headers.slice(1).map((h) => h.trim()).filter(Boolean);
    const out: MotivosTempo["rows"] = [];
    for (const row of rows) {
      if (isEnd(row[0])) break;
      if (squash(row[0]) === "motivo") continue; // segunda linha de títulos ("MOTIVO | % | %...")
      out.push({ motivo: row[0].trim(), values: buckets.map((_, i) => parsePercent(row[i + 1])) });
    }
    if (out.length === 0) return { error: "Não encontrei os motivos nesta planilha." };
    return { kind: "MOTIVOS_TEMPO", data: { buckets, rows: out } };
  }
  if (first === "categoria") {
    const out: Satisfacao["rows"] = [];
    let total: Satisfacao["total"] = null;
    for (const row of rows) {
      if (isEnd(row[0])) break;
      const item = { categoria: row[0].trim(), satisfacao: parsePercent(row[1]), criticos: parsePercent(row[2]) };
      if (squash(row[0]) === "total") total = { satisfacao: item.satisfacao, criticos: item.criticos };
      else out.push(item);
    }
    if (out.length === 0) return { error: "Não encontrei as categorias nesta planilha." };
    return { kind: "SATISFACAO", data: { rows: out, total } };
  }
  return { error: 'Não reconheci este formato. Esperado: "TEMPO DE CASA" (motivos por tempo de casa) ou "CATEGORIA" (satisfação por categoria) na primeira coluna.' };
}

const NOT_ACTIONABLE = ["razoespessoais", "outros", "outro"];

/** Frases para o diagnóstico do PDCA a partir das tabelas. Só fatos que os números sustentam. */
export function surveyDiagnosis(motivos: MotivosTempo | null, satisfacao: Satisfacao | null): string[] {
  const out: string[] = [];
  if (motivos) {
    const actionable = motivos.rows.filter((r) => !NOT_ACTIONABLE.includes(squash(r.motivo)));
    const picks: string[] = [];
    motivos.buckets.forEach((b, i) => {
      const top = actionable.map((r) => ({ motivo: r.motivo, v: r.values[i] })).filter((x): x is { motivo: string; v: number } => x.v !== null).sort((a, c) => c.v - a.v)[0];
      if (top && top.v >= 15) picks.push(`${b}: ${top.motivo} (${top.v}%)`);
    });
    if (picks.length > 0) out.push(`Na plataforma de entrevistas, o motivo de saída mais citado (fora razões pessoais e outros) muda com o tempo de casa: ${picks.slice(0, 4).join("; ")}.`);
    const personalEarly = motivos.rows.find((r) => squash(r.motivo) === "razoespessoais")?.values[0];
    if (personalEarly !== null && personalEarly !== undefined && personalEarly >= 25) out.push(`${personalEarly}% das saídas nos primeiros ${motivos.buckets[0].toLowerCase()} são por razões pessoais: vale ouvir o que está por trás disso na integração e na seleção.`);
  }
  if (satisfacao) {
    const scored = satisfacao.rows.filter((r) => r.satisfacao !== null) as { categoria: string; satisfacao: number; criticos: number | null }[];
    const low = [...scored].sort((a, b) => a.satisfacao - b.satisfacao)[0];
    if (low) out.push(`Categoria com menor satisfação entre os que saíram: ${low.categoria.toLowerCase()} (${low.satisfacao}%).`);
    const crit = [...satisfacao.rows].filter((r) => r.criticos !== null && r.criticos >= 5).sort((a, b) => (b.criticos ?? 0) - (a.criticos ?? 0))[0];
    if (crit) out.push(`${crit.criticos}% dos itens de ${crit.categoria.toLowerCase()} foram marcados como críticos.`);
  }
  return out;
}
