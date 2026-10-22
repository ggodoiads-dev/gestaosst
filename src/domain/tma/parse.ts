/**
 * Leitura da planilha de TMA (controle de atendimento de caminhões, usada com a Ambev). Cada aba "TMA OUT-26" é um mês; cada linha é
 * um caminhão. O layout mudou ao longo do ano (colunas a mais ou a menos), então as colunas são achadas pelo NOME do cabeçalho,
 * nunca pela posição. Esta leitura roda no navegador (o arquivo passa de 5 MB) e só os dados já limpos vão para o servidor.
 */

export type TmaRowInput = {
  gradeDate: string; // AAAA-MM-DD
  status: string;
  presentation: string | null; // APRESENTADO / APRESENTADO COM ATRASO / NÃO APRESENTADO
  destino: string | null;
  tipoCarro: string | null;
  pedido: string | null;
  placas: string | null;
  motorista: string | null;
  transportadora: string | null;
  conferente: string | null;
  turno: string | null;
  checklist: string | null;
  /** AAAA-MM-DDTHH:mm, horário de relógio (sem fuso). */
  agendamento: string | null;
  apresentacao: string | null;
  entradaAtendimento: string | null;
  entradaBaia: string | null;
  inicioCarregamento: string | null;
  fimCarregamento: string | null;
  fimAmarracao: string | null;
  liberacao: string | null;
  /** Minutos. `tmaMin` = o TMA da planilha da Ambev (coluna TMA; se ela não vier, o calculado pela regra do agendamento) — inclui a espera
   * no pátio de quem chega antes. `atendimentoMin` = da entrada no atendimento até a liberação (o tempo de atendimento em si). */
  tmaMin: number | null;
  atendimentoMin: number | null;
  patioMin: number | null;
  esperaMin: number | null;
  tmcMin: number | null;
  amarracaoMin: number | null;
  liberacaoMin: number | null;
};

const MONTH_ABBR: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };

export function norm(text: unknown): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "TMA OUT-26" → "2026-10". Aba que não é de mês (DASH, AUX...) → null. */
export function periodKeyFromSheetName(name: string): string | null {
  const m = /^TMA\s+([A-Z]{3})-(\d{2})\b/.exec(norm(name));
  if (!m || !MONTH_ABBR[m[1]]) return null;
  return `20${m[2]}-${String(MONTH_ABBR[m[1]]).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Número serial do Excel → "AAAA-MM-DDTHH:mm" (relógio da planilha, sem fuso). */
export function serialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000 / 60000) * 60000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function toIso(value: unknown): string | null {
  if (typeof value === "number") return serialToIso(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  return null;
}

/** Duração da planilha (fração de dia) → minutos. Valor negativo, vazio ou absurdo (erro de fórmula) vira null. */
export function durationToMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 10) return null; // até 10 dias
  return Math.round(value * 1440 * 100) / 100;
}

const minutesBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const diff = (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60000;
  return Number.isFinite(diff) ? diff : null;
};

/** Tempo de atendimento: da entrada no atendimento até a liberação do veículo. */
export function computeAtendimentoMinutes(row: Pick<TmaRowInput, "entradaAtendimento" | "liberacao">): number | null {
  const minutes = minutesBetween(row.entradaAtendimento, row.liberacao);
  return minutes !== null && minutes > 0 && minutes <= 10 * 1440 ? Math.round(minutes * 100) / 100 : null;
}

/**
 * Regra do TMA da planilha da Ambev (conferida nos dados de set/out: bate em 97% dos caminhões): se o caminhão se apresentou no horário ou adiantado,
 * conta do horário agendado (ou da entrada no atendimento, se ele entrou antes do agendamento) até a liberação; se se apresentou
 * atrasado, conta da entrada no atendimento até a liberação.
 */
export function computeTmaMinutes(row: Pick<TmaRowInput, "agendamento" | "apresentacao" | "entradaAtendimento" | "liberacao">): number | null {
  const { agendamento, apresentacao, entradaAtendimento, liberacao } = row;
  if (!entradaAtendimento || !liberacao) return null;
  let start = entradaAtendimento;
  if (agendamento && apresentacao && apresentacao <= agendamento) start = agendamento < entradaAtendimento ? agendamento : entradaAtendimento;
  const minutes = minutesBetween(start, liberacao);
  return minutes !== null && minutes > 0 ? Math.round(minutes * 100) / 100 : null;
}

const text = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" || s === "-" ? null : s.slice(0, 120);
};

type ColumnMap = Record<string, number>;

function findColumns(header: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  const cells = header.map(norm);
  const find = (key: string, matcher: (h: string) => boolean) => {
    const i = cells.findIndex(matcher);
    if (i >= 0) map[key] = i;
  };
  find("grade", (h) => h === "DATA DA GRADE" || h === "DATA");
  // Layouts antigos: "STATUS". Layout novo: o status fica na coluna "ARMAZEM" e "STATUS." é a apresentação.
  find("status", (h) => h === "STATUS");
  if (map.status === undefined) find("status", (h) => h === "ARMAZEM");
  find("presentation", (h) => h === "STATUS.");
  find("pedido", (h) => h === "PEDIDO");
  find("destino", (h) => h === "DESTINO");
  find("tipoCarro", (h) => h === "TIPO CARRO");
  find("placas", (h) => h === "PLACAS");
  find("motorista", (h) => h === "MOTORISTA");
  find("transportadora", (h) => h === "TRANSPORTADORA");
  find("conferente", (h) => h === "CONFERENTE");
  find("turno", (h) => h === "AUX TURNO" || h === "TURNO");
  find("checklist", (h) => h.startsWith("CHECK") && !h.includes("DESCRICAO"));
  find("agendamento", (h) => h === "AGENDAMENTO");
  find("apresentacao", (h) => h.startsWith("APRESENTACAO"));
  find("entradaAtendimento", (h) => h === "ENTRADA ATENDIMENTO");
  find("entradaBaia", (h) => h === "ENTRADA NA BAIA");
  find("inicioCarregamento", (h) => h.startsWith("INICIO CARREGAMENTO"));
  find("fimCarregamento", (h) => h.startsWith("FIM CARREGAMENTO"));
  find("fimAmarracao", (h) => h.startsWith("FIM AMARRACAO"));
  find("liberacao", (h) => h.startsWith("LIBERACAO DO VEICULO"));
  find("tma", (h) => h === "TMA");
  find("patio", (h) => h === "TEMPO DE PATIO");
  find("espera", (h) => h.startsWith("TEMPO DE ESPERA ARMAZEM"));
  find("tmc", (h) => h.startsWith("TEMPO DE CARREGAMENTO"));
  find("amarracao", (h) => h === "TEMPO DE AMARRACAO");
  find("liberacaoTempo", (h) => h === "TEMPO DE LIBERACAO");
  return map;
}

export type ParsedTmaSheet = { rows: TmaRowInput[]; warnings: string[] };

/** Linhas de uma aba mensal (grade = matriz de células; números de data/hora em formato serial do Excel). */
export function parseTmaSheet(grid: unknown[][]): ParsedTmaSheet {
  const headerIndex = grid.findIndex((row) => (row ?? []).some((c) => norm(c) === "DATA DA GRADE"));
  const fallbackIndex = headerIndex >= 0 ? headerIndex : grid.findIndex((row) => norm(row?.[0]) === "DATA" || norm(row?.[1]) === "DATA");
  if (fallbackIndex < 0) return { rows: [], warnings: ["Não achei o cabeçalho (DATA DA GRADE) nesta aba."] };
  const cols = findColumns(grid[fallbackIndex] ?? []);
  if (cols.grade === undefined || cols.status === undefined || cols.liberacao === undefined) {
    return { rows: [], warnings: ["Faltam colunas essenciais (data da grade, status ou liberação do veículo) nesta aba."] };
  }
  const warnings: string[] = [];
  if (cols.agendamento === undefined) warnings.push("Esta aba não tem a coluna AGENDAMENTO: o TMA vem da coluna TMA da planilha.");

  const get = (row: unknown[], key: string) => (cols[key] === undefined ? undefined : row[cols[key]]);
  const rows: TmaRowInput[] = [];
  for (let r = fallbackIndex + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const gradeIso = toIso(get(row, "grade"));
    const status = text(get(row, "status"));
    if (!gradeIso || !status) continue;
    const base: TmaRowInput = {
      gradeDate: gradeIso.slice(0, 10),
      status: norm(status),
      presentation: text(get(row, "presentation")),
      destino: text(get(row, "destino")),
      tipoCarro: text(get(row, "tipoCarro")),
      pedido: text(get(row, "pedido")),
      placas: text(get(row, "placas")),
      motorista: text(get(row, "motorista")),
      transportadora: text(get(row, "transportadora")),
      conferente: text(get(row, "conferente")),
      turno: text(get(row, "turno")),
      checklist: text(get(row, "checklist")),
      agendamento: toIso(get(row, "agendamento")),
      apresentacao: toIso(get(row, "apresentacao")),
      entradaAtendimento: toIso(get(row, "entradaAtendimento")),
      entradaBaia: toIso(get(row, "entradaBaia")),
      inicioCarregamento: toIso(get(row, "inicioCarregamento")),
      fimCarregamento: toIso(get(row, "fimCarregamento")),
      fimAmarracao: toIso(get(row, "fimAmarracao")),
      liberacao: toIso(get(row, "liberacao")),
      tmaMin: null,
      atendimentoMin: null,
      patioMin: durationToMinutes(get(row, "patio")),
      esperaMin: durationToMinutes(get(row, "espera")),
      tmcMin: durationToMinutes(get(row, "tmc")),
      amarracaoMin: durationToMinutes(get(row, "amarracao")),
      liberacaoMin: durationToMinutes(get(row, "liberacaoTempo")),
    };
    const fromSheet = durationToMinutes(get(row, "tma"));
    base.tmaMin = fromSheet !== null && fromSheet > 0 ? fromSheet : computeTmaMinutes(base);
    base.atendimentoMin = computeAtendimentoMinutes(base);
    rows.push(base);
  }
  return { rows, warnings };
}
