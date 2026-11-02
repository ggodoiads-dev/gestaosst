import "server-only";
import { db } from "@/server/db";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getGuardianAdherence } from "@/server/services/guardian.service";
import { getTmaView } from "@/server/services/tma.service";
import { TMA_TARGET_MIN, formatDuration } from "@/domain/tma/stats";
import { accidentFindings, deltaText, guardianFindings, kpi, tmaFindings, trendTone } from "@/domain/reports/analysis";
import type { Finding } from "@/domain/reports/types";
import { daysBetween, lastMonths, pct, range, shortLabel } from "@/server/services/report.service";
import { countBy, keyOfDate, sec, tbl, type DetailCtx, type Out } from "@/server/services/report-kit";

const TYPE_LABEL: Record<string, string> = { ACIDENTE_TIPICO: "Acidente típico", ACIDENTE_TRAJETO: "Acidente de trajeto", QUASE_ACIDENTE: "Quase acidente", DOENCA_OCUPACIONAL: "Doença ocupacional", FAI: "FAI (1º atendimento)" };
const SEV_LABEL: Record<string, string> = { CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
const SIF_LABEL: Record<string, string> = { SIF_PRECURSOR: "SIF precursor", SIF_POTENCIAL: "SIF potencial", SIF_REAL: "SIF real" };
const INJURY = ["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "FAI", "DOENCA_OCUPACIONAL"];
const dm = (d: Date) => `${d.toISOString().slice(8, 10)}/${d.toISOString().slice(5, 7)}`;

// ------------------------------------------------------------------------------------------------ Acidentes
export async function buildAccidentsReport(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.ACCIDENT_MANAGE)) throw new ForbiddenError();
  const now = new Date();
  const months = lastMonths(c.month, 12);
  const [rows, lastInjury, overdueActions, openInvestigations] = await Promise.all([
    db.accident.findMany({
      where: { date: { gte: range(months[0]).start, lt: range(c.month).end }, status: { not: "CANCELADA" } },
      select: { code: true, date: true, time: true, type: true, severity: true, isSif: true, sifClassification: true, status: true, description: true, area: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    db.accident.findFirst({ where: { type: { in: INJURY as never[] }, status: { not: "CANCELADA" }, date: { lt: range(c.month).end } }, orderBy: { date: "desc" }, select: { date: true, code: true } }),
    db.accidentAction.findMany({ where: { dueDate: { lt: now }, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } }, select: { description: true, dueDate: true, accident: { select: { code: true } } }, orderBy: { dueDate: "asc" }, take: 10 }),
    db.accident.findMany({ where: { status: { in: ["ABERTO", "EM_INVESTIGACAO"] } }, select: { code: true, date: true, type: true } }),
  ]);
  const cur = rows.filter((r) => keyOfDate(r.date) === c.month);
  const prevRows = rows.filter((r) => keyOfDate(r.date) === c.prev);
  const inj = (l: typeof rows) => l.filter((r) => INJURY.includes(r.type)).length;
  const sif = cur.filter((r) => r.isSif).length;
  const sifReal = cur.filter((r) => r.sifClassification === "SIF_REAL").length;
  const byMonth = (pred: (r: (typeof rows)[number]) => boolean) => months.map((m) => ({ label: shortLabel(m), value: rows.filter((r) => keyOfDate(r.date) === m && pred(r)).length }));
  const band = (t: string | null) => {
    if (!t) return "Sem horário";
    const h = Number(t.slice(0, 2));
    return h < 6 ? "Madrugada (0h–5h)" : h < 12 ? "Manhã (6h–11h)" : h < 18 ? "Tarde (12h–17h)" : "Noite (18h–23h)";
  };
  const weekday = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const daysSince = lastInjury ? daysBetween(lastInjury.date, now) : null;
  const findings: Finding[] = accidentFindings({ total: cur.length, prevTotal: prevRows.length, withInjury: inj(cur), sif, sifReal, latestCodes: cur.filter((r) => r.isSif).map((r) => r.code) });
  if (overdueActions.length > 0) findings.push({ severity: "ALTO", module: "Acidentes", title: `${overdueActions.length} ação(ões) de investigação vencida(s)`, detail: "Ações de acidentes com prazo passado e sem conclusão.", recommendation: "Cobrar o responsável ou renegociar o prazo com justificativa." });
  const staleInv = openInvestigations.filter((a) => daysBetween(a.date, now) > 30);
  if (staleInv.length > 0) findings.push({ severity: "ATENCAO", module: "Acidentes", title: `${staleInv.length} investigação(ões) abertas há mais de 30 dias`, detail: `Ocorrências ainda em aberto: ${staleInv.slice(0, 4).map((a) => a.code).join(", ")}.`, recommendation: "Concluir a investigação ou registrar o que falta para encerrar." });
  const twelve = rows;

  return {
    title: "Relatório de acidentes, incidentes e SIF",
    executive: [
      kpi("a1", "Ocorrências no mês", String(cur.length), trendTone(cur.length, prevRows.length, false), deltaText(cur.length, prevRows.length, "abs")),
      kpi("a2", "Com lesão", String(inj(cur)), inj(cur) > 0 ? "bad" : "good", deltaText(inj(cur), inj(prevRows), "abs")),
      kpi("a3", "Com potencial SIF", String(sif), sif > 0 ? "bad" : "good", undefined, sifReal > 0 ? `${sifReal} SIF real` : undefined),
      kpi("a4", "Dias sem acidente com lesão", daysSince === null ? "—" : String(daysSince), daysSince !== null && daysSince >= 30 ? "good" : "warn", undefined, lastInjury ? `último: ${lastInjury.code}` : undefined),
    ],
    findings,
    sections: [
      sec("ac-mes", "O mês e os últimos 12 meses", "Ocorrências da LOG20 registradas no SIGO, sem as canceladas.", {
        series: [
          { title: "Ocorrências por mês", highlightLast: true, points: byMonth(() => true) },
          { title: "Com lesão por mês", highlightLast: true, points: byMonth((r) => INJURY.includes(r.type)) },
          { title: "Com potencial SIF por mês", highlightLast: true, points: byMonth((r) => r.isSif) },
        ],
        tables: [
          tbl("Por tipo (mês × 12 meses)", ["Tipo", "No mês", "12 meses"], Object.keys(TYPE_LABEL).map((t) => [TYPE_LABEL[t], cur.filter((r) => r.type === t).length, twelve.filter((r) => r.type === t).length]).filter((r) => Number(r[2]) > 0), { rightAlign: [1, 2] }),
          tbl("Por severidade (12 meses)", ["Severidade", "Ocorrências"], ["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((s) => [SEV_LABEL[s], twelve.filter((r) => r.severity === s).length]).filter((r) => Number(r[1]) > 0), { rightAlign: [1] }),
          tbl("Classificação SIF (12 meses)", ["Classificação", "Ocorrências"], countBy(twelve.filter((r) => r.sifClassification), (r) => SIF_LABEL[r.sifClassification as string] ?? String(r.sifClassification)), { rightAlign: [1] }),
        ],
      }),
      sec("ac-padroes", "Padrões: onde e quando", "Concentração por área, horário e dia da semana nos últimos 12 meses, para achar o padrão antes de agir.", {
        tables: [
          tbl("Por área", ["Área", "Ocorrências"], countBy(twelve, (r) => r.area?.name ?? "Sem área").slice(0, 8), { rightAlign: [1] }),
          tbl("Por faixa de horário", ["Faixa", "Ocorrências"], countBy(twelve, (r) => band(r.time)), { rightAlign: [1] }),
          tbl("Por dia da semana", ["Dia", "Ocorrências"], countBy(twelve, (r) => weekday[r.date.getUTCDay()]), { rightAlign: [1] }),
        ],
      }),
      sec("ac-controle", "Controle das investigações", "Ações de acidentes vencidas e a lista completa do mês.", {
        tables: [
          tbl("Ações vencidas", ["Ocorrência", "Ação", "Prazo"], overdueActions.map((a) => [a.accident.code, a.description.length > 80 ? `${a.description.slice(0, 77)}…` : a.description, dm(a.dueDate)])),
          tbl("Ocorrências do mês", ["Código", "Data", "Tipo", "Severidade", "Área", "Descrição"], cur.map((r) => [r.code, dm(r.date), TYPE_LABEL[r.type] ?? r.type, SEV_LABEL[r.severity] ?? r.severity, r.area?.name ?? "—", r.description.length > 120 ? `${r.description.slice(0, 117)}…` : r.description]), { internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Guardian
export async function buildGuardianReport(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.GUARDIAN_MANAGE) && !hasPermission(c.user, PERMISSIONS.GUARDIAN_VIEW)) throw new ForbiddenError();
  const { selected, history } = await getGuardianAdherence(c.user, c.month);
  const prev = history.find((h) => h.month === c.prev) ?? null;
  const series = history.filter((h) => h.month <= c.month).slice(0, 12).reverse();
  const turnos = new Map<string, { reported: number; not: number }>();
  for (const r of selected.ranking) {
    const k = r.turnoName ?? "Sem turno";
    const v = turnos.get(k) ?? { reported: 0, not: 0 };
    v.reported++;
    turnos.set(k, v);
  }
  for (const p of selected.notReported) {
    const k = p.turnoName ?? "Sem turno";
    const v = turnos.get(k) ?? { reported: 0, not: 0 };
    v.not++;
    turnos.set(k, v);
  }
  const typeLabel: Record<string, string> = { COMPORTAMENTO_RISCO: "Comportamento de risco", CONDICAO_INSEGURA: "Condição insegura", INCIDENTE: "Incidente", RECONHECIMENTO: "Reconhecimento" };
  const worst = [...turnos.entries()].sort((a, b) => b[1].not - a[1].not)[0];
  const findings = guardianFindings({ adherence: selected.adherencePercent, prevAdherence: prev?.adherencePercent ?? null, notReported: selected.notReportedCount, scheduled: selected.activeCollaboratorsCount, worstTurno: worst ? { name: worst[0], count: worst[1].not } : null, internal: c.internal });
  const total = selected.reportsCount;
  const topShare = selected.ranking.length && total > 0 ? Math.round((selected.ranking.slice(0, 3).reduce((s, r) => s + r.count, 0) / total) * 100) : null;
  if (topShare !== null && topShare >= 50 && total >= 10) findings.push({ severity: "ATENCAO", module: "Guardian", title: "Relatos concentrados em poucas pessoas", detail: `As 3 pessoas que mais relatam respondem por ${topShare}% dos relatos do mês.`, recommendation: "Ampliar a participação: a adesão pode estar alta com poucos relatos por pessoa ou o contrário." });

  return {
    title: "Relatório do Guardian — adesão e relatos de segurança",
    executive: [
      kpi("g1", "Adesão", pct(selected.adherencePercent), selected.adherencePercent >= 90 ? "good" : selected.adherencePercent >= 70 ? "warn" : "bad", deltaText(selected.adherencePercent, prev?.adherencePercent, "pts")),
      kpi("g2", "Relataram", `${selected.reportedCount} de ${selected.activeCollaboratorsCount}`, "neutral"),
      kpi("g3", "Não relataram", String(selected.notReportedCount), selected.notReportedCount > 0 ? "warn" : "good"),
      kpi("g4", "Relatos no mês", String(total), trendTone(total, prev?.reportsCount, true), deltaText(total, prev?.reportsCount, "pct")),
    ],
    findings,
    sections: [
      sec("gd-adesao", "Adesão mês a mês", `${selected.frozen ? "Mês fechado: valores travados." : "Mês em andamento: recomeça do zero a cada mês."} Adesão = colaboradores que relataram ao menos uma vez ÷ colaboradores na casa no mês.`, {
        series: [
          { title: "Adesão por mês (%)", unit: "%", highlightLast: true, points: series.map((h) => ({ label: shortLabel(h.month), value: h.adherencePercent })) },
          { title: "Relatos por mês", highlightLast: true, points: series.map((h) => ({ label: shortLabel(h.month), value: h.reportsCount })) },
        ],
        tables: [tbl("Histórico", ["Mês", "Colaboradores", "Relataram", "Adesão (%)", "Relatos"], [...series].reverse().map((h) => [shortLabel(h.month), h.activeCollaboratorsCount, h.reportedCount, h.adherencePercent, h.reportsCount]), { rightAlign: [1, 2, 3, 4] })],
        notes: selected.lastReportDay ? [`Relatos importados até ${selected.lastReportDay.split("-").reverse().join("/")}.`] : [],
      }),
      sec("gd-quem", "Quem relata e onde faltam relatos", "Distribuição por tipo e por turno; nomes só na versão interna.", {
        tables: [
          tbl("Relatos por tipo", ["Tipo", "Relatos"], selected.byType.map((t) => [typeLabel[t.type] ?? t.type, t.count]), { rightAlign: [1] }),
          tbl("Adesão por turno", ["Turno", "Relataram", "Não relataram", "Adesão (%)"], [...turnos.entries()].map(([t, v]) => [t, v.reported, v.not, v.reported + v.not ? Math.round((v.reported / (v.reported + v.not)) * 100) : 0]).sort((a, b) => Number(a[3]) - Number(b[3])), { rightAlign: [1, 2, 3] }),
          tbl("Quem mais relatou", ["Colaborador", "Turno", "Relatos"], selected.ranking.slice(0, 15).map((r) => [r.name, r.turnoName ?? "—", r.count]), { rightAlign: [2], internalOnly: true }),
          tbl("Quem ainda não relatou", ["Colaborador", "Turno"], selected.notReported.slice(0, 40).map((p) => [p.name, p.turnoName ?? "—"]), { internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ TMA
export async function buildTmaReport(c: DetailCtx): Promise<Out> {
  const [view, prevView] = await Promise.all([getTmaView(c.user, c.month), getTmaView(c.user, c.prev)]);
  if (!view.ready || view.selected !== c.month || !view.month) throw new Error("Não há TMA importado para este mês.");
  const m = view.month;
  const pm = prevView.ready && prevView.selected === c.prev ? prevView.month : null;
  const findings = tmaFindings({ avgMin: m.avgTma, prevAvgMin: pm?.avgTma ?? null, within3h: m.within3h, targetMin: TMA_TARGET_MIN });
  const days = [...m.byDay];
  const worstDays = [...days].filter((d) => d.avgTma !== null).sort((a, b) => (b.avgTma ?? 0) - (a.avgTma ?? 0)).slice(0, 5);
  if (worstDays.length && (worstDays[0].avgTma ?? 0) > TMA_TARGET_MIN * 1.5) findings.push({ severity: "ATENCAO", module: "TMA", title: "Dias muito fora da meta", detail: `Pior dia: ${worstDays[0].day.slice(8)}/${worstDays[0].day.slice(5, 7)}, com média de ${formatDuration(worstDays[0].avgTma)} (${worstDays[0].count} carros).`, recommendation: "Ver o que aconteceu nesses dias (quebra, falta de equipe, fila de chegada)." });
  const group = (rows: typeof m.byTurno, limit = 12) => rows.slice(0, limit).map((g) => [g.name, g.count, formatDuration(g.avgTma), g.within3h === null ? "—" : Math.round(g.within3h), formatDuration(g.avgAmarracao)] as (string | number)[]);
  const cols = ["", "Carros", "TMA", "Em até 3 h (%)", "Amarração"];

  return {
    title: "Relatório de TMA — tempo de atendimento do caminhão",
    executive: [
      kpi("t1", "TMA", formatDuration(m.avgTma), m.avgTma === null ? "neutral" : m.avgTma <= TMA_TARGET_MIN ? "good" : "bad", deltaText(m.avgTma, pm?.avgTma, "pct"), `meta ${formatDuration(TMA_TARGET_MIN)}`),
      kpi("t2", "Carros em até 3 h", m.within3h === null ? "—" : pct(m.within3h), m.within3h === null ? "neutral" : m.within3h >= 70 ? "good" : m.within3h >= 50 ? "warn" : "bad", deltaText(m.within3h, pm?.within3h, "pts")),
      kpi("t3", "Carros carregados", String(m.carregados.total), "neutral", deltaText(m.carregados.total, pm?.carregados.total, "pct")),
      kpi("t4", "Carros amarrados", String(m.amarrados.total), "neutral", undefined, `tempo médio ${formatDuration(m.amarrados.avgAmarracao)}`),
    ],
    findings,
    sections: [
      sec("tma-geral", "Visão geral e etapas", "TMA = coluna da Ambev dos carros liberados com agendamento. Carregado = liberado no mês; amarrado = tem o fim da amarração.", {
        kpis: [
          kpi("t5", "TMC (carregamento)", formatDuration(m.avgTmc), "neutral"),
          kpi("t6", "Com agendamento", m.withSchedule === null ? "—" : pct(m.withSchedule), "neutral", undefined, m.onTime === null ? undefined : `${pct(m.onTime)} no horário`),
          kpi("t7", "Não apresentaram", String(m.notShown), m.notShown > 0 ? "warn" : "good", undefined, `${m.holes} furo(s)`),
        ],
        series: [{ title: "TMA médio por dia de liberação (minutos)", highlightLast: false, points: days.map((d) => ({ label: d.day.slice(8), value: Math.round(d.avgTma ?? 0) })) }],
        tables: [
          tbl("Onde o tempo é gasto", ["Etapa", "Média"], [["Pátio (antes de entrar)", formatDuration(m.stages.patio)], ["Espera no armazém", formatDuration(m.stages.espera)], ["Carregamento (TMC)", formatDuration(m.stages.carregamento)], ["Amarração", formatDuration(m.stages.amarracao)], ["Liberação", formatDuration(m.stages.liberacao)]], { rightAlign: [1] }),
          tbl("Piores dias", ["Dia", "Carros", "TMA médio"], worstDays.map((d) => [`${d.day.slice(8)}/${d.day.slice(5, 7)}`, d.count, formatDuration(d.avgTma)]), { rightAlign: [1, 2] }),
        ],
      }),
      sec("tma-onde", "Onde o tempo se perde", "Comparativo por turno, transportadora, destino e conferente (maiores volumes).", {
        tables: [
          tbl("Por turno", ["Turno", ...cols.slice(1)], group(m.byTurno), { rightAlign: [1, 2, 3, 4] }),
          tbl("Por transportadora", ["Transportadora", ...cols.slice(1)], group(m.byTransportadora), { rightAlign: [1, 2, 3, 4] }),
          tbl("Por destino", ["Destino", ...cols.slice(1)], group(m.byDestino), { rightAlign: [1, 2, 3, 4] }),
          tbl("Por conferente", ["Conferente", ...cols.slice(1)], group(m.byConferente), { rightAlign: [1, 2, 3, 4], internalOnly: true }),
        ],
      }),
    ],
  };
}
