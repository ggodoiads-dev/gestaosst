/** Tudo que o SIGO sabe sobre "Regra de Ouro" e "liderança" no Guardian, sem acesso a banco (testável). */

export type GoldenRuleOutcome = "APLICADO_MDT" | "DESCONSIDERADO";

export const GOLDEN_RULE_OUTCOME_LABELS: Record<GoldenRuleOutcome, string> = {
  APLICADO_MDT: "Aplicado MDT",
  DESCONSIDERADO: "Desconsiderado",
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseRaw(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function pick(raw: Record<string, string>, header: string): string | null {
  const target = norm(header);
  for (const [k, v] of Object.entries(raw)) {
    if (norm(k) === target && typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

/** A coluna "Regra de Ouro" da planilha do Guardian vem "Sim", "Não" ou vazia — só "Sim" é regra de ouro. A linha original inteira
 * fica guardada no relato (`raw`), então isso vale também para o que já foi importado antes. */
export function isGoldenRule(raw: string | null | undefined): boolean {
  const v = pick(parseRaw(raw), "Regra de Ouro");
  return v !== null && norm(v) === "sim";
}

/** Quem a planilha aponta como "Reportado" (a pessoa envolvida na ocorrência), pra quem decide o MDT saber de quem se trata. */
export function reportedPerson(raw: string | null | undefined): { name: string | null; company: string | null; cargo: string | null } {
  const r = parseRaw(raw);
  return { name: pick(r, "Nome do Reportado"), company: pick(r, "Empresa do Reportado"), cargo: pick(r, "Cargo do Reportado") };
}

function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Turno administrativo ("ADM", "Administrativo"...). */
export function isAdmTurno(turnoName: string | null | undefined): boolean {
  return !!turnoName && /(^|[^a-z])adm/.test(plain(turnoName));
}

/** Sugestão (usada só enquanto ninguém ajustou) de cargos do turno ADM que são operação, não liderança — ex.: ajudante de armazém. */
export function looksLikeOperationalFunction(functionName: string | null | undefined): boolean {
  return !!functionName && /(^|[^a-z])ajudante/.test(plain(functionName));
}

/** Liderança no Guardian = todo o time ADM (turno administrativo), menos os cargos de operação cadastrados nesse turno. */
export function isGuardianLeader(c: { turnoName: string | null; functionId: string | null; functionName: string | null }, operationalFunctionIds: Set<string> | null): boolean {
  if (!isAdmTurno(c.turnoName)) return false;
  return operationalFunctionIds ? !(c.functionId && operationalFunctionIds.has(c.functionId)) : !looksLikeOperationalFunction(c.functionName);
}

export type GuardianGroupFilter = "geral" | "operacao" | "lideranca";

export function parseGroupFilter(value: string | undefined): GuardianGroupFilter {
  return value === "operacao" || value === "lideranca" ? value : "geral";
}

/** AAAA-MM-DD válido (ou null). */
export function parseDayKey(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

/** Período pedido na tela, preso aos limites do mês. Sem nenhuma data = sem filtro. Se vier invertido, troca. */
export function clampPeriodToMonth(month: string, from: string | null, to: string | null): { from: string; to: string } | null {
  if (!from && !to) return null;
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  let a = from ?? first;
  let b = to ?? last;
  if (a > b) [a, b] = [b, a];
  if (a < first) a = first;
  if (b > last) b = last;
  if (a > b) return null;
  return { from: a, to: b };
}
