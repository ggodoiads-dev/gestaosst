/** Converte o prazo em texto sugerido pelo Rico ("Imediato", "7 dias", "2 semanas", "1 mês") em dias corridos. */
export function parseDeadlineDays(label: string, fallback = 14): number {
  const text = label.toLowerCase();
  if (/imediat|hoje|urgente/.test(text)) return 2;
  const n = Number(text.match(/(\d+)/)?.[1]);
  if (Number.isFinite(n) && n > 0) {
    if (/semana/.test(text)) return Math.min(n * 7, 180);
    if (/m[eê]s/.test(text)) return Math.min(n * 30, 180);
    if (/dia/.test(text)) return Math.min(n, 180);
  }
  return fallback;
}
