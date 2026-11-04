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
