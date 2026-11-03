/**
 * PDCA do turnover. O indicador segue o BI da empresa: demissões do mês e do ano ÷ QLP (ver `buildYearResults`).
 * As regras abaixo são puras (sem banco) e alimentam a tela do PDCA.
 */
import { presenceAt, type Presence } from "./presence";


/** Uma causa na cascata: `parentId` é o ramo dos dados ("a:motivo:BENEFICIOS") ou outra causa (o "por quê?" do nível seguinte). `root` marca a causa raiz. */
export type PdcaCause = { id: string; text: string; evidence: string; parentId?: string | null; root?: boolean };
export type PdcaActionStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
/** `causeId` liga a ação à causa que ela ataca na cascata. */
export type PdcaAction = { id: string; what: string; why: string; who: string; due: string; status: PdcaActionStatus; note: string; causeId?: string | null };

export const PDCA_ACTION_STATUS_LABEL: Record<PdcaActionStatus, string> = { PENDENTE: "Pendente", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída" };

/**
 * Conta do BI (número oficial): turnover do mês = demissões do mês ÷ QLP do mês; acumulado do ano (YTD) = demissões acumuladas ÷ média do QLP dos
 * meses do ano até ali (ex.: 15 demissões ÷ QLP 57,00 = 26,32%). Só entram demissões que contam no turnover.
 */
export type YearMonthInput = { month: string; exits: number; qlp: number; qlpSource: "oficial" | "cadastro" };
export type YearMonthResult = YearMonthInput & {
  /** Turnover do mês (%). */
  rate: number | null;
  ytdExits: number;
  /** Média do QLP de janeiro até o mês. */
  ytdQlp: number;
  /** Turnover acumulado do ano (%). */
  ytdRate: number | null;
};

/** Demissões ÷ QLP em %, com 2 casas (como o BI). `null` sem QLP. */
export function qlpRate(exits: number, qlp: number): number | null {
  return qlp > 0 ? Math.round((exits / qlp) * 10000) / 100 : null;
}

/** Meses fechados do ano, em ordem (janeiro primeiro), com o turnover do mês e o acumulado. */
export function buildYearResults(months: YearMonthInput[]): YearMonthResult[] {
  let ytdExits = 0;
  let qlpSum = 0;
  return months.map((m, i) => {
    ytdExits += m.exits;
    qlpSum += m.qlp;
    const ytdQlp = qlpSum / (i + 1);
    return { ...m, rate: qlpRate(m.exits, m.qlp), ytdExits, ytdQlp, ytdRate: qlpRate(ytdExits, ytdQlp) };
  });
}

export type GoalStatus = "DENTRO" | "ATENCAO" | "FORA" | "SEM_META";

/** Dentro da meta (≤ meta), atenção (até 10% acima da meta) ou fora. */
export function goalStatus(rate: number | null, goal: number | null): GoalStatus {
  if (rate === null || goal === null) return "SEM_META";
  if (rate <= goal) return "DENTRO";
  return rate <= goal * 1.1 ? "ATENCAO" : "FORA";
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = { DENTRO: "Dentro da meta", ATENCAO: "Atenção", FORA: "Fora da meta", SEM_META: "Sem meta" };

/** Quantos desligamentos ainda cabem na janela mantendo a meta (pode ser negativo: já estourou). */
export function exitsBudget(goal: number | null, avgHeadcount: number, exitsInWindow: number): number | null {
  if (goal === null || avgHeadcount <= 0) return null;
  return Math.floor((goal / 100) * avgHeadcount) - exitsInWindow;
}

export type DiagnosisInput = {
  exits: number;
  voluntary: number;
  early90: number;
  withTenure: number;
  unclassified: number;
  topArea: { label: string; count: number } | null;
  topTurno: { label: string; count: number } | null;
  topCargo: { label: string; count: number } | null;
  peakMonth: { label: string; count: number } | null;
};

const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Diagnóstico automático (fase Plan): só fatos que os números sustentam. Sem desligamentos suficientes, não conclui nada. */
export function diagnose(i: DiagnosisInput): string[] {
  const out: string[] = [];
  if (i.exits < 5) return ["Poucos desligamentos na janela para concluir padrão (menos de 5). Acompanhe mais alguns meses."];
  if (i.withTenure >= 5 && pctOf(i.early90, i.withTenure) >= 30) out.push(`${pctOf(i.early90, i.withTenure)}% das saídas com data de admissão foram em até 90 dias: olhar seleção, integração e a adequação da vaga.`);
  if (pctOf(i.voluntary, i.exits) >= 50) out.push(`${pctOf(i.voluntary, i.exits)}% das saídas são pedido de demissão: investigar clima, liderança, remuneração e condição de trabalho (entrevista de desligamento).`);
  for (const [name, top] of [["área", i.topArea], ["turno", i.topTurno], ["cargo", i.topCargo]] as const) {
    if (top && top.count >= 3 && pctOf(top.count, i.exits) >= 40) out.push(`${pctOf(top.count, i.exits)}% das saídas estão concentradas em um só ${name}: ${top.label} (${top.count} de ${i.exits}).`);
  }
  if (i.peakMonth && i.peakMonth.count >= 3 && pctOf(i.peakMonth.count, i.exits) >= 25) out.push(`${i.peakMonth.label} concentra ${pctOf(i.peakMonth.count, i.exits)}% das saídas da janela: ver o que aconteceu nesse mês (reestruturação, pagamento, mudança de escala).`);
  if (pctOf(i.unclassified, i.exits) >= 20) out.push(`${pctOf(i.unclassified, i.exits)}% das saídas estão sem classificação de tipo: o diagnóstico fica incompleto até o motivo ser padronizado na planilha do RH.`);
  if (out.length === 0) out.push("Nenhum padrão forte nos números (sem concentração acima de 40% em área, turno ou cargo, e sem excesso de saídas precoces ou pedidos de demissão).");
  return out;
}

/**
 * Entrada mensal da conta do BI para os meses fechados do ano (janeiro até `lastIdx`). O QLP do mês é o informado pelo RH (base oficial);
 * sem ele, estimativa pelo cadastro: média do efetivo no início e no fim do mês.
 */
export function yearMonthInputs(args: {
  year: number;
  lastIdx: number;
  now: Date;
  counted: { terminationDate: Date }[];
  people: Presence[];
  headcountBase: Map<string, number>;
}): YearMonthInput[] {
  const { year, lastIdx, now, counted, people, headcountBase } = args;
  return Array.from({ length: Math.max(lastIdx + 1, 0) }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const official = headcountBase.get(key);
    const start = new Date(year, m, 1);
    const end = new Date(year, m + 1, 1);
    const estimated = (presenceAt(people, start) + presenceAt(people, end > now ? now : end)) / 2;
    return {
      month: key,
      exits: counted.filter((t) => t.terminationDate.getFullYear() === year && t.terminationDate.getMonth() === m).length,
      qlp: official ?? estimated,
      qlpSource: official !== undefined ? ("oficial" as const) : ("cadastro" as const),
    };
  });
}
