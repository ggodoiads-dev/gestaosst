import type { Finding, Kpi, Tone } from "./types";

/** Variação percentual (null se não dá para comparar). */
export function pctDelta(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const abs = (n: number) => Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** "+3 pts", "−12%": comparação com o mês anterior. `kind`: pontos percentuais ou variação relativa. */
export function deltaText(cur: number | null | undefined, prev: number | null | undefined, kind: "pts" | "pct" | "abs" = "pct"): string | undefined {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return undefined;
  if (kind === "pts") {
    const d = Math.round((cur - prev) * 10) / 10;
    return d === 0 ? "= mês anterior" : `${sign(d)}${abs(d)} pts vs. mês anterior`;
  }
  if (kind === "abs") {
    const d = cur - prev;
    return d === 0 ? "= mês anterior" : `${sign(d)}${abs(d)} vs. mês anterior`;
  }
  const d = pctDelta(cur, prev);
  if (d === null) return cur === prev ? "= mês anterior" : undefined;
  return d === 0 ? "= mês anterior" : `${sign(d)}${abs(d)}% vs. mês anterior`;
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "04/out": o dia (1 a 31) de um mês (AAAA-MM), para dizer "até 04/out". */
export function dayLabel(month: string, day: number): string {
  const m = Number(month.slice(5, 7));
  return `${String(day).padStart(2, "0")}/${MONTH_SHORT[m - 1] ?? ""}`;
}

/**
 * Comparação justa no mês em andamento: em vez de pôr o mês parcial contra o mês anterior inteiro, compara com o mesmo ponto do mês passado.
 * Ex.: "até 04/out: 72% · +45 pts". Valores em %. `undefined` se faltar algum dos dois.
 */
export function sameDayCompare(cur: number | null | undefined, prev: number | null | undefined, cut: string): { delta: string; sameDay: NonNullable<Kpi["sameDay"]> } | undefined {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return undefined;
  const d = Math.round((cur - prev) * 10) / 10;
  const change = d === 0 ? "igual" : `${sign(d)}${abs(d)} pts`;
  return { delta: `até ${cut}: ${abs(prev)}% · ${change}`, sameDay: { cut, cur, prev } };
}

/** Tom da variação: `higherIsBetter` diz se subir é bom. Variação pequena (<3%) é neutra. */
export function trendTone(cur: number | null | undefined, prev: number | null | undefined, higherIsBetter: boolean, minRelative = 3): Tone {
  const d = pctDelta(cur, prev);
  if (d === null) return "neutral";
  if (Math.abs(d) < minRelative) return "neutral";
  return (d > 0) === higherIsBetter ? "good" : "bad";
}

export function kpi(key: string, label: string, value: string, tone: Tone = "neutral", delta?: string, note?: string): Kpi {
  return { key, label, value, tone, delta, note };
}

// ---------------------------------------------------------------- regras de pontos críticos (uma função por módulo, só números)

export function accidentFindings(i: {
  total: number;
  prevTotal: number | null;
  withInjury: number;
  sif: number;
  sifReal: number;
  latestCodes: string[];
}): Finding[] {
  const out: Finding[] = [];
  if (i.sifReal > 0) {
    out.push({ severity: "CRITICO", module: "Acidentes", title: `${i.sifReal} ocorrência(s) SIF real no mês`, detail: `Evento com potencial de fatalidade que de fato ocorreu (${i.latestCodes.slice(0, 4).join(", ")}).`, recommendation: "Investigação formal com plano de ação e validação da liderança em até 48 h; compartilhar o aprendizado com todos os turnos." });
  } else if (i.sif > 0) {
    out.push({ severity: "ALTO", module: "Acidentes", title: `${i.sif} ocorrência(s) com potencial SIF`, detail: "Eventos que poderiam ter causado lesão grave ou fatal, classificados como precursor ou potencial.", recommendation: "Tratar cada um como se tivesse ocorrido: causa raiz, barreira nova e verificação de eficácia." });
  }
  if (i.withInjury > 0) {
    out.push({ severity: "ALTO", module: "Acidentes", title: `${i.withInjury} ocorrência(s) com lesão`, detail: "Acidente típico, de trajeto, FAI ou doença ocupacional no mês.", recommendation: "Conferir se a investigação foi concluída no prazo e se as ações corrigem a causa raiz, não só o sintoma." });
  }
  if (i.prevTotal !== null && i.total >= 3 && i.total > i.prevTotal * 1.3) {
    out.push({ severity: "ATENCAO", module: "Acidentes", title: "Ocorrências em alta", detail: `${i.total} no mês contra ${i.prevTotal} no mês anterior.`, recommendation: "Procurar o que concentra o aumento (área, turno, atividade) antes de agir de forma geral." });
  }
  if (i.total === 0) {
    out.push({ severity: "INFO", module: "Acidentes", title: "Sem ocorrências registradas no mês", detail: "Nenhum acidente, quase acidente ou SIF da LOG20 registrado no período." });
  }
  return out;
}

export function guardianFindings(i: { adherence: number; prevAdherence: number | null; notReported: number; scheduled: number; worstTurno: { name: string; count: number } | null; internal: boolean }): Finding[] {
  const out: Finding[] = [];
  if (i.adherence < 40) {
    out.push({ severity: "CRITICO", module: "Guardian", title: `Adesão ao Guardian em ${i.adherence}%`, detail: `${i.notReported} de ${i.scheduled} colaboradores não relataram nada no mês.`, recommendation: "Cobrança direta das lideranças e meta de um relato por pessoa até o dia 15." });
  } else if (i.adherence < 70) {
    out.push({ severity: "ALTO", module: "Guardian", title: `Adesão ao Guardian abaixo de 70% (${i.adherence}%)`, detail: `${i.notReported} colaboradores ainda sem relato no mês.`, recommendation: i.worstTurno ? `Começar pelo turno ${i.worstTurno.name}, que concentra ${i.worstTurno.count} pendências.` : "Cobrar as lideranças dos turnos com mais pendências." });
  }
  if (i.prevAdherence !== null && i.prevAdherence - i.adherence >= 15) {
    out.push({ severity: "ALTO", module: "Guardian", title: `Queda de ${i.prevAdherence - i.adherence} pontos na adesão`, detail: `De ${i.prevAdherence}% no mês anterior para ${i.adherence}%.`, recommendation: "Verificar se os relatos foram todos importados antes de concluir que houve queda real." });
  }
  return out;
}

export function dtoFindings(i: { count: number; avgScore: number | null; prevAvg: number | null; below60: number }): Finding[] {
  const out: Finding[] = [];
  if (i.count === 0) return out;
  if (i.avgScore !== null && i.avgScore < 80) {
    out.push({ severity: "ATENCAO", module: "DTO", title: `Nota média de DTO em ${i.avgScore}%`, detail: `Média das ${i.count} avaliações do mês.`, recommendation: "Olhar as atividades com pior nota e reforçar o treinamento ali." });
  }
  if (i.below60 > 0) {
    out.push({ severity: "ALTO", module: "DTO", title: `${i.below60} avaliação(ões) com nota abaixo de 60%`, detail: "Desvios relevantes de comportamento observados em campo.", recommendation: "Conversa individual com o colaborador e a liderança, e nova avaliação em até 15 dias.", internalOnly: true });
  }
  if (i.prevAvg !== null && i.avgScore !== null && i.prevAvg - i.avgScore >= 8) {
    out.push({ severity: "ATENCAO", module: "DTO", title: "Nota de DTO em queda", detail: `De ${i.prevAvg}% para ${i.avgScore}% em relação ao mês anterior.` });
  }
  return out;
}

export function checklistFindings(i: { percent: number | null; prevPercent: number | null; pendingShifts: number; isCurrentMonth: boolean }): Finding[] {
  const out: Finding[] = [];
  if (i.percent === null) return out;
  if (i.percent < 70) {
    out.push({ severity: "ALTO", module: "Checklists", title: `Aderência de checklist em ${i.percent}%`, detail: `${i.pendingShifts} turno(s) com checklist cobrado e não cumprido${i.isCurrentMonth ? " (até ontem)" : ""}.`, recommendation: "Separar o que é falha de execução do que é falta de acesso ou de checklist configurado." });
  } else if (i.percent < 90) {
    out.push({ severity: "ATENCAO", module: "Checklists", title: `Aderência de checklist em ${i.percent}%`, detail: `${i.pendingShifts} turno(s) pendente(s).`, recommendation: "Acompanhar as pessoas com mais pendências na lista do relatório." });
  }
  if (i.prevPercent !== null && i.prevPercent - i.percent >= 10) {
    out.push({ severity: "ATENCAO", module: "Checklists", title: "Aderência de checklist em queda", detail: `De ${i.prevPercent}% para ${i.percent}% em relação ao mês anterior.` });
  }
  return out;
}

export function nonconformityFindings(i: {
  openCritical: number;
  oldestCriticalDays: number | null;
  openOver30: number;
  openTotal: number;
  withoutResponsible: number;
  overdueActions: number;
  blockedEquipments: number;
}): Finding[] {
  const out: Finding[] = [];
  if (i.openCritical > 0) {
    out.push({ severity: "CRITICO", module: "Não conformidades", title: `${i.openCritical} NC(s) crítica(s) em aberto`, detail: i.oldestCriticalDays !== null ? `A mais antiga está aberta há ${i.oldestCriticalDays} dia(s).` : "Sem tratamento concluído.", recommendation: "Responsável e prazo definidos hoje; item crítico não pode ficar sem dono." });
  }
  if (i.openOver30 > 0) {
    out.push({ severity: "ALTO", module: "Não conformidades", title: `${i.openOver30} NC(s) abertas há mais de 30 dias`, detail: `De ${i.openTotal} em aberto no total.`, recommendation: "Revisar se são NCs duplicadas do mesmo defeito (agrupar) ou se falta ação executável." });
  }
  if (i.withoutResponsible > 0) {
    out.push({ severity: "ATENCAO", module: "Não conformidades", title: `${i.withoutResponsible} NC(s) sem responsável`, detail: "Sem dono não há prazo nem cobrança.", recommendation: "Atribuir responsável a todas ainda hoje." });
  }
  if (i.overdueActions > 0) {
    out.push({ severity: "ALTO", module: "Planos de ação", title: `${i.overdueActions} ação(ões) vencida(s)`, detail: "Ações com prazo passado e sem conclusão.", recommendation: "Renegociar prazo com justificativa ou escalar para a liderança." });
  }
  if (i.blockedEquipments > 0) {
    out.push({ severity: "ALTO", module: "Equipamentos", title: `${i.blockedEquipments} equipamento(s) bloqueado(s)`, detail: "Parados até a liberação; cada um dependendo de todas as NCs abertas dele serem validadas.", recommendation: "Priorizar a validação das ações dos equipamentos que travam a operação." });
  }
  return out;
}

export function tmaFindings(i: { avgMin: number | null; prevAvgMin: number | null; within3h: number | null; targetMin: number }): Finding[] {
  const out: Finding[] = [];
  if (i.avgMin === null) return out;
  if (i.avgMin > i.targetMin * 1.33) {
    out.push({ severity: "CRITICO", module: "TMA", title: "TMA muito acima da meta", detail: `Média de ${fmtHM(i.avgMin)} contra meta de ${fmtHM(i.targetMin)}.`, recommendation: "Abrir a etapa que mais pesa (espera, carregamento ou amarração) e atacar ali." });
  } else if (i.avgMin > i.targetMin) {
    out.push({ severity: "ALTO", module: "TMA", title: "TMA acima da meta", detail: `Média de ${fmtHM(i.avgMin)} contra meta de ${fmtHM(i.targetMin)}.`, recommendation: "Comparar turnos e transportadoras no relatório para achar onde o tempo é perdido." });
  }
  if (i.within3h !== null && i.within3h < 50) {
    out.push({ severity: "ATENCAO", module: "TMA", title: `Só ${i.within3h}% dos caminhões saem em até 3 h`, detail: "Menos da metade da frota cumpre a meta de tempo." });
  }
  if (i.prevAvgMin !== null && i.avgMin - i.prevAvgMin >= 15) {
    out.push({ severity: "ATENCAO", module: "TMA", title: "TMA piorou em relação ao mês anterior", detail: `De ${fmtHM(i.prevAvgMin)} para ${fmtHM(i.avgMin)}.` });
  }
  return out;
}

export function productionFindings(i: { loadedPerDay: number | null; prevLoadedPerDay: number | null; daysWithReport: number; daysInPeriod: number }): Finding[] {
  const out: Finding[] = [];
  if (i.loadedPerDay !== null && i.prevLoadedPerDay !== null && i.prevLoadedPerDay > 0 && i.loadedPerDay < i.prevLoadedPerDay * 0.85) {
    out.push({ severity: "ATENCAO", module: "Produção", title: "Carros carregados por dia em queda", detail: `${i.loadedPerDay} por dia contra ${i.prevLoadedPerDay} no mês anterior.`, recommendation: "Conferir se é queda de demanda ou perda de produtividade, e se há dias sem relatório lançado.", internalOnly: true });
  }
  if (i.daysInPeriod > 0 && i.daysWithReport < i.daysInPeriod * 0.8) {
    out.push({ severity: "INFO", module: "Produção", title: "Relatórios de turno incompletos", detail: `Há relatório em ${i.daysWithReport} de ${i.daysInPeriod} dias do período; os totais podem estar subestimados.`, internalOnly: true });
  }
  return out;
}

export function fmtHM(minutes: number): string {
  const t = Math.round(minutes);
  return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, "0")}`;
}

const ORDER = { CRITICO: 0, ALTO: 1, ATENCAO: 2, INFO: 3 } as const;
export function sortFindings(list: Finding[]): Finding[] {
  return [...list].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
