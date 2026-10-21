/**
 * Leitura do export "Demonstrativo de Resultados" (DRE) da plataforma financeira. Layout:
 *  - linha 3: "UNIDADES SELECIONADAS: ..."; linha 4 (coluna G): "OFICIAL ATUALIZADO EM: dd/mm/aaaa hh:mm";
 *  - cabeçalho: "CONTA" e, para cada mês, "JANEIRO/2026 (30 DIAS UTEIS)" ocupando 4 colunas — REMUNERADO, REALIZADO,
 *    DIFERENCA e AVR (%) — mais um bloco "TOTAL (n DIAS UTEIS)" no fim;
 *  - cada conta: "001 | ( = ) RECEITA LÍQUIDA" (o recuo depois da barra indica o nível), com números no formato 1.234,56.
 */
export type DreLineRow = {
  code: string;
  name: string;
  /** 0 = totalizador ("( = )", "( - )"), 1 em diante = subcontas. */
  level: number;
  remunerado: number;
  realizado: number;
  diferenca: number;
  /** % sobre a receita líquida realizada (coluna AVR do export). */
  avr: number;
  position: number;
};

export type DreMonth = { periodKey: string; label: string; lines: DreLineRow[] };

export type ParsedDre = {
  unit: string | null;
  officialAt: string | null;
  months: DreMonth[];
  /** Receita líquida realizada do bloco TOTAL do arquivo (pra conferir com a soma dos meses). */
  totalRevenue: number | null;
  warnings: string[];
};

const MONTH_NUMBER: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function strip(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

/** "1.234,56" → 1234.56; aceita número, texto vazio (0) e "-". */
export function parseBrNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (text === "" || text === "-") return 0;
  const n = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function parseDreGrid(grid: unknown[][]): ParsedDre {
  const warnings: string[] = [];
  const cell = (r: number, c: number) => (grid[r]?.[c] === null || grid[r]?.[c] === undefined ? "" : String(grid[r][c]).trim());

  const unitText = grid.slice(0, 6).map((row) => String(row?.[0] ?? "")).find((t) => /UNIDADES SELECIONADAS/i.test(t));
  const unit = unitText ? unitText.replace(/.*UNIDADES SELECIONADAS:\s*/i, "").trim() || null : null;
  let officialAt: string | null = null;
  for (let r = 0; r < 6 && !officialAt; r++) {
    for (const value of grid[r] ?? []) {
      const m = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/.exec(String(value ?? ""));
      if (m) officialAt = m[1];
    }
  }

  const headerRow = grid.findIndex((row) => strip(String(row?.[0] ?? "")) === "CONTA");
  if (headerRow < 0) return { unit, officialAt, months: [], totalRevenue: null, warnings: ['Não encontrei o cabeçalho "CONTA". Use o export "Demonstrativo de Resultados" da plataforma financeira.'] };

  // Blocos de 4 colunas: um por mês e o TOTAL no final.
  const blocks: { col: number; periodKey: string | null; label: string }[] = [];
  const header = grid[headerRow] ?? [];
  for (let c = 1; c < header.length; c++) {
    const text = String(header[c] ?? "").trim();
    if (!text) continue;
    const month = /^([A-Za-zÇç]+)\/(\d{4})/.exec(text);
    if (month && MONTH_NUMBER[strip(month[1])]) {
      blocks.push({ col: c, periodKey: `${month[2]}-${String(MONTH_NUMBER[strip(month[1])]).padStart(2, "0")}`, label: text });
    } else if (/^TOTAL/i.test(text)) {
      blocks.push({ col: c, periodKey: null, label: text });
    }
  }
  if (blocks.filter((b) => b.periodKey).length === 0) {
    return { unit, officialAt, months: [], totalRevenue: null, warnings: ["Não encontrei nenhum mês no cabeçalho do arquivo."] };
  }

  const months: DreMonth[] = blocks.filter((b) => b.periodKey).map((b) => ({ periodKey: b.periodKey!, label: b.label, lines: [] }));
  const totalBlock = blocks.find((b) => !b.periodKey) ?? null;
  let totalRevenue: number | null = null;

  let position = 0;
  for (let r = headerRow + 2; r < grid.length; r++) {
    const raw = String(grid[r]?.[0] ?? "");
    const m = /^\s*(\d{3})\s*\|(.*)$/.exec(raw);
    if (!m) continue;
    const code = m[1];
    const nameWithIndent = m[2];
    const leading = nameWithIndent.length - nameWithIndent.replace(/^\s+/, "").length;
    const name = nameWithIndent.trim();
    // Os totalizadores ("( = )", "( - )") ficam no nível 0; as subcontas recuam de 3 em 3 espaços.
    const level = /^\(\s*[=\-+/ ]*\s*\)/.test(name) ? 0 : Math.max(1, Math.round(leading / 3));
    position++;
    blocks.forEach((b) => {
      const values = {
        remunerado: parseBrNumber(grid[r]?.[b.col]),
        realizado: parseBrNumber(grid[r]?.[b.col + 1]),
        diferenca: parseBrNumber(grid[r]?.[b.col + 2]),
        avr: parseBrNumber(grid[r]?.[b.col + 3]),
      };
      if (b.periodKey) months.find((x) => x.periodKey === b.periodKey)!.lines.push({ code, name, level, position, ...values });
      else if (code === "001") totalRevenue = values.realizado;
    });
  }
  void totalBlock;

  const revenueSum = months.reduce((sum, mo) => sum + (mo.lines.find((l) => l.code === "001")?.realizado ?? 0), 0);
  if (totalRevenue !== null && Math.abs(revenueSum - totalRevenue) > 1) {
    warnings.push("A soma da receita dos meses não bate com o TOTAL do arquivo. Confira se o export tem todos os meses do período.");
  }
  if (months.every((mo) => mo.lines.length === 0)) warnings.push("Nenhuma conta foi lida. Use o export original do DRE.");
  return { unit, officialAt, months, totalRevenue, warnings };
}
