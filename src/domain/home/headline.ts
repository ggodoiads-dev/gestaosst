/** Frase de abertura da tela inicial (visual novo): resume o dia com os números reais. Pura, para testar. */
export type MarkTone = "mint" | "sky" | "lemon" | "rose";
export type HeadlinePart = { text: string; mark?: MarkTone; serif?: boolean };

export type HeadlineInput = {
  alertCount: number;
  criticalCount: number;
  checklistPct: number | null;
  turnover: { rate: number | null; goal: number | null } | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildHeadline(i: HeadlineInput): HeadlinePart[] {
  const parts: HeadlinePart[] = [];
  if (i.alertCount === 0) {
    parts.push({ text: "Tudo em ordem hoje: " }, { text: "nenhum aviso", mark: "mint" }, { text: " disparado." });
  } else {
    parts.push({ text: "Hoje a operação tem " }, { text: plural(i.alertCount, "ponto", "pontos"), serif: true, mark: "lemon" }, { text: " pedindo você" });
    if (i.criticalCount > 0) parts.push({ text: ", " }, { text: plural(i.criticalCount, "crítico", "críticos"), mark: "rose" });
    parts.push({ text: "." });
  }
  if (i.checklistPct !== null) {
    parts.push({ text: " A aderência de checklist está em " }, { text: `${i.checklistPct}%`, mark: i.checklistPct >= 90 ? "mint" : i.checklistPct >= 80 ? "lemon" : "rose" });
    if (!(i.turnover && i.turnover.rate !== null)) parts.push({ text: "." });
  }
  if (i.turnover && i.turnover.rate !== null) {
    const within = i.turnover.goal === null ? null : i.turnover.rate <= i.turnover.goal;
    parts.push({ text: i.checklistPct !== null ? " e o turnover está " : " O turnover está " });
    parts.push(within === null ? { text: `em ${String(i.turnover.rate).replace(".", ",")}%`, mark: "sky" } : { text: within ? "dentro da meta" : "acima da meta", mark: within ? "mint" : "rose" }, { text: "." });
  }
  return parts;
}

// ── Painel: abertura mais completa ──

const brNum = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Título do Painel: quantos pontos pedem atenção e se algum é crítico. */
export function buildPainelHeadline(i: { alertCount: number; criticalCount: number }): HeadlinePart[] {
  if (i.alertCount === 0) return [{ text: "Operação em ordem: " }, { text: "nenhum aviso", mark: "mint" }, { text: " disparado hoje." }];
  const parts: HeadlinePart[] = [{ text: plural(i.alertCount, "ponto pede", "pontos pedem"), serif: true, mark: "lemon" }, { text: " a sua atenção hoje" }];
  if (i.criticalCount === 0) parts.push({ text: ", " }, { text: "nenhum crítico", mark: "mint" }, { text: "." });
  else if (i.criticalCount === 1) parts.push({ text: ", e " }, { text: "1 é crítico", mark: "rose" }, { text: ": comece por ele." });
  else parts.push({ text: ", e " }, { text: `${i.criticalCount} são críticos`, mark: "rose" }, { text: ": comece por eles." });
  return parts;
}

export type BriefingMetric = { pct: number; sameDay?: { cut: string; prev: number } | null };
export type BriefingInput = {
  checklist: BriefingMetric | null;
  guardian: BriefingMetric | null;
  turnover: { rate: number | null; goal: number | null } | null;
};

function metricSentence(lead: string, m: BriefingMetric, tone: (pct: number) => MarkTone): HeadlinePart[] {
  const parts: HeadlinePart[] = [{ text: `${lead} ` }, { text: `${brNum(m.pct)}%`, mark: tone(m.pct) }];
  if (m.sameDay) {
    const d = Math.round((m.pct - m.sameDay.prev) * 10) / 10;
    parts.push({ text: `: até ${m.sameDay.cut} do mês passado estava em ${brNum(m.sameDay.prev)}%` });
    if (d === 0) parts.push({ text: ", o mesmo ritmo" });
    else parts.push({ text: ", " }, { text: `${d > 0 ? "+" : "−"}${brNum(Math.abs(d))} pts`, mark: d > 0 ? "mint" : "rose" });
  }
  parts.push({ text: "." });
  return parts;
}

/**
 * Parágrafo logo abaixo do título do Painel: checklist e Guardian no mês (comparados com o MESMO ponto do mês passado, não com o mês inteiro) e o turnover
 * do ano contra a meta. Cada frase só entra se o número existir.
 */
export function buildPainelBriefing(i: BriefingInput): HeadlinePart[] {
  const sentences: HeadlinePart[][] = [];
  if (i.checklist) sentences.push(metricSentence("A aderência de checklist está em", i.checklist, (p) => (p >= 90 ? "mint" : p >= 80 ? "lemon" : "rose")));
  if (i.guardian) sentences.push(metricSentence("A adesão ao Guardian está em", i.guardian, (p) => (p >= 90 ? "mint" : p >= 70 ? "lemon" : "rose")));
  if (i.turnover && i.turnover.rate !== null) {
    const rate = i.turnover.rate;
    const goal = i.turnover.goal;
    if (goal === null) sentences.push([{ text: "O turnover do ano está em " }, { text: `${brNum(rate)}%`, mark: "sky" }, { text: "." }]);
    else {
      const within = rate <= goal;
      sentences.push([{ text: "O turnover do ano está " }, { text: within ? "dentro da meta" : "acima da meta", mark: within ? "mint" : "rose" }, { text: `, em ${brNum(rate)}% contra ${String(goal).replace(".", ",")}%.` }]);
    }
  }
  return sentences.flatMap((s, idx) => (idx === 0 ? s : [{ text: " " }, ...s]));
}
