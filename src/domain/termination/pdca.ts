/**
 * PDCA do turnover. O indicador é o turnover dos ÚLTIMOS 12 MESES: desligamentos da janela de 12 meses ÷ efetivo médio dessa janela.
 * As regras abaixo são puras (sem banco) e alimentam a tela do PDCA.
 */

export type PdcaCause = { id: string; text: string; evidence: string };
export type PdcaActionStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA";
export type PdcaAction = { id: string; what: string; why: string; who: string; due: string; status: PdcaActionStatus; note: string };

export const PDCA_ACTION_STATUS_LABEL: Record<PdcaActionStatus, string> = { PENDENTE: "Pendente", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída" };

export type WindowMonth = { exits: number; headcountStart: number; headcountEnd: number };

/** Turnover móvel: soma dos desligamentos ÷ média do efetivo mensal (média de início e fim de cada mês) da janela. `null` sem base. */
export function rollingTurnover(window: WindowMonth[]): number | null {
  if (window.length === 0) return null;
  const avg = window.reduce((s, m) => s + (m.headcountStart + m.headcountEnd) / 2, 0) / window.length;
  if (avg <= 0) return null;
  const exits = window.reduce((s, m) => s + m.exits, 0);
  return Math.round((exits / avg) * 1000) / 10;
}

export function averageHeadcount(window: WindowMonth[]): number {
  return window.length ? window.reduce((s, m) => s + (m.headcountStart + m.headcountEnd) / 2, 0) / window.length : 0;
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
