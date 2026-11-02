import "server-only";
import { db } from "@/server/db";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { canViewProduction, getProductionView } from "@/server/services/production.service";
import { canLogProductivityForOthers, getAllProductivityGoalsProgress, getProductivityDashboard } from "@/server/services/productivity.service";
import { getDreView } from "@/server/services/dre.service";
import { PRODUCTION_GROUPS, fieldsOfGroup } from "@/domain/production/fields";
import { disciplineReasonLabel, disciplineStepLabel } from "@/domain/discipline/ladder";
import { deltaText, kpi, productionFindings, trendTone } from "@/domain/reports/analysis";
import type { Finding } from "@/domain/reports/types";
import { daysBetween, lastMonths, pct, range, shortLabel } from "@/server/services/report.service";
import { countBy, keyOfDate, sec, tbl, type DetailCtx, type Out } from "@/server/services/report-kit";

const NOT_FOR_CLIENT = "Não há versão do cliente para este relatório: ele contém dados internos de pessoas.";
const dm = (d: Date) => `${d.toISOString().slice(8, 10)}/${d.toISOString().slice(5, 7)}`;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const bucketMonths = (months: string[], dates: Date[]) => months.map((m) => ({ label: shortLabel(m), value: dates.filter((d) => keyOfDate(d) === m).length }));

// ------------------------------------------------------------------------------------------------ Produção por turno
export async function buildProductionReport(c: DetailCtx): Promise<Out> {
  if (!c.internal) throw new Error(NOT_FOR_CLIENT);
  if (!canViewProduction(c.user)) throw new ForbiddenError();
  const months = lastMonths(c.month, 12);
  const [view, prevView, rows] = await Promise.all([
    getProductionView(c.user, c.month),
    getProductionView(c.user, c.prev),
    db.shiftProduction.findMany({ where: { date: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { date: true, values: true } }).catch(() => []),
  ]);
  if (!view.ready || view.month.reports === 0) throw new Error("Não há relatório de turno lançado para este mês.");
  const m = view.month;
  const pm = prevView.month;
  const t = m.totals;
  const sumField = (key: string, list: typeof rows) => list.reduce((s, r) => s + (((r.values as Record<string, number> | null)?.[key]) ?? 0), 0);
  const inMonth = (mk: string) => rows.filter((r) => keyOfDate(r.date) === mk);
  const daysInPeriod = c.month === c.nowKey ? new Date().getUTCDate() : new Date(Date.UTC(Number(c.month.slice(0, 4)), Number(c.month.slice(5, 7)), 0)).getUTCDate();
  const findings: Finding[] = productionFindings({ loadedPerDay: m.avgLoadedPerDay, prevLoadedPerDay: pm.avgLoadedPerDay, daysWithReport: m.daysWithReport, daysInPeriod });
  if ((t.quedaProduto ?? 0) > 0) findings.push({ severity: "ATENCAO", module: "Produção", title: `${t.quedaProduto} queda(s) de produto no mês`, detail: "Perda de produto registrada nos relatórios de turno.", recommendation: "Cruzar as quedas com o turno, a atividade e o equipamento envolvido para achar o padrão.", internalOnly: true });
  if ((t.absOperador ?? 0) >= 5) findings.push({ severity: "ATENCAO", module: "Produção", title: `${t.absOperador} ausência(s) de operador nos turnos`, detail: "Somadas nos relatórios de fim de turno.", recommendation: "Ver se há dia ou turno recorrente e ajustar a escala ou a cobertura.", internalOnly: true });
  const dayRows = [...m.byDay];
  const best = [...dayRows].sort((a, b) => b.carrosCarregados - a.carrosCarregados).slice(0, 5);
  const worst = [...dayRows].filter((d) => d.carrosCarregados > 0).sort((a, b) => a.carrosCarregados - b.carrosCarregados).slice(0, 5);
  const groupRows = (g: (typeof PRODUCTION_GROUPS)[number]["key"]) => fieldsOfGroup(g).filter((f) => (t[f.key] ?? 0) > 0 || (pm.totals[f.key] ?? 0) > 0).map((f) => [f.label, t[f.key] ?? 0, pm.totals[f.key] ?? 0] as (string | number)[]);
  const notes = view.reports.filter((r) => r.notes).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 12);

  return {
    title: "Relatório de produção por turno",
    executive: [
      kpi("p1", "Carros carregados", String(t.carrosCarregados ?? 0), trendTone(m.avgLoadedPerDay, pm.avgLoadedPerDay, true), deltaText(m.avgLoadedPerDay, pm.avgLoadedPerDay, "pct")?.replace("mês anterior", "mês anterior (por dia)")),
      kpi("p2", "Média por dia", m.avgLoadedPerDay === null ? "—" : String(m.avgLoadedPerDay), "neutral", `${m.daysWithReport} dia(s) com relatório`),
      kpi("p3", "Carregados ÷ trabalhados", m.loadedRate === null ? "—" : pct(m.loadedRate), "neutral"),
      kpi("p4", "Itens carregados", (m.cargasTotal).toLocaleString("pt-BR"), "neutral", deltaText(m.cargasTotal, pm.cargasTotal, "pct")),
    ],
    findings,
    sections: [
      sec("pr-visao", "Visão geral e tendência", "Relatórios de fim de turno lançados pelos líderes (um por dia e turno). Todo carro carregado é amarrado.", {
        kpis: [kpi("p5", "Carros trabalhados", String(t.carrosTrabalhados ?? 0), "neutral"), kpi("p6", "Itens descarregados", m.descargasTotal.toLocaleString("pt-BR"), "neutral", deltaText(m.descargasTotal, pm.descargasTotal, "pct")), kpi("p7", "Relatórios lançados", String(m.reports), "neutral")],
        series: [
          { title: "Carros carregados por mês", highlightLast: true, points: months.map((mk) => ({ label: shortLabel(mk), value: sumField("carrosCarregados", inMonth(mk)) })) },
          { title: "Carros carregados por dia do mês", highlightLast: false, points: dayRows.map((d) => ({ label: d.day.slice(8), value: d.carrosCarregados })) },
        ],
        tables: [
          tbl("Comparativo entre turnos", ["Turno", "Relatórios", "Trabalhados", "Carregados", "Média/relatório"], m.byTurno.map((tu) => [`Turno ${tu.turno}`, tu.reports, tu.totals.carrosTrabalhados ?? 0, tu.totals.carrosCarregados ?? 0, tu.reports > 0 ? Math.round(((tu.totals.carrosCarregados ?? 0) / tu.reports) * 10) / 10 : 0]), { rightAlign: [1, 2, 3, 4] }),
          tbl("Melhores dias (carros carregados)", ["Dia", "Carregados", "Trabalhados"], best.map((d) => [`${d.day.slice(8)}/${d.day.slice(5, 7)}`, d.carrosCarregados, d.carrosTrabalhados]), { rightAlign: [1, 2] }),
          tbl("Piores dias (carros carregados)", ["Dia", "Carregados", "Trabalhados"], worst.map((d) => [`${d.day.slice(8)}/${d.day.slice(5, 7)}`, d.carrosCarregados, d.carrosTrabalhados]), { rightAlign: [1, 2] }),
        ],
      }),
      sec("pr-itens", "Cargas, descargas e ocorrências", "Totais dos campos dos relatórios de turno, no mês e no mês anterior.", {
        tables: [
          tbl("Ocorrências do turno", ["Item", "No mês", "Mês anterior"], groupRows("GERAL").filter((r) => !String(r[0]).startsWith("Carros")), { rightAlign: [1, 2] }),
          tbl("Cargas", ["Item", "No mês", "Mês anterior"], groupRows("CARGAS"), { rightAlign: [1, 2] }),
          tbl("Descargas", ["Item", "No mês", "Mês anterior"], groupRows("DESCARGAS"), { rightAlign: [1, 2] }),
          tbl("Seleção e reforma", ["Item", "No mês", "Mês anterior"], groupRows("SELECAO"), { rightAlign: [1, 2] }),
          tbl("Observações dos líderes", ["Dia", "Turno", "Observação"], notes.map((r) => [`${r.day.slice(8)}/${r.day.slice(5, 7)}`, r.turno, (r.notes ?? "").length > 160 ? `${(r.notes ?? "").slice(0, 157)}…` : (r.notes ?? "")])),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Produtividade dos ajudantes
export async function buildProductivityReport(c: DetailCtx): Promise<Out> {
  if (!c.internal) throw new Error(NOT_FOR_CLIENT);
  if (!canLogProductivityForOthers(c.user) && !hasPermission(c.user, PERMISSIONS.PRODUCTIVITY_VIEW)) throw new ForbiddenError();
  const months = lastMonths(c.month, 12);
  const date = c.month === c.nowKey ? new Date() : new Date(Number(c.month.slice(0, 4)), Number(c.month.slice(5, 7)) - 1, 15);
  const [{ month: m }, goals, entries] = await Promise.all([
    getProductivityDashboard(c.user, { date }),
    getAllProductivityGoalsProgress(c.user, { month: Number(c.month.slice(5, 7)), year: Number(c.month.slice(0, 4)) }).catch(() => []),
    db.productivityEntry.findMany({ where: { date: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { date: true } }),
  ]);
  if (m.collaboratorsScheduled === 0) throw new Error("Não há ajudantes escalados neste mês para o relatório de produtividade.");
  const adherence = Math.round((m.collaboratorsLogged / m.collaboratorsScheduled) * 100);
  const idle = m.byCollaborator.filter((x) => !x.covered);
  const findings: Finding[] = [];
  if (idle.length > 0) findings.push({ severity: "ATENCAO", module: "Produtividade", title: `${idle.length} ajudante(s) sem o lançamento esperado`, detail: "Escalados no mês, sem produção lançada na atividade da área deles.", recommendation: "Regularizar pelo \"Lançar o dia da equipe\" e confirmar se a atividade da área está definida.", internalOnly: true });
  if (adherence < 70) findings.push({ severity: "ALTO", module: "Produtividade", title: `Só ${adherence}% dos ajudantes escalados têm lançamento`, detail: `${m.collaboratorsLogged} de ${m.collaboratorsScheduled}.`, recommendation: "Definir quem lança o dia de cada turno e a rotina diária de lançamento.", internalOnly: true });
  const lowGoals = goals.filter((g) => g.percent < 60);
  if (c.month !== c.nowKey && lowGoals.length > 0) findings.push({ severity: "ATENCAO", module: "Produtividade", title: `${lowGoals.length} meta(s) abaixo de 60% no fechamento do mês`, detail: "Metas individuais de produção não atingidas.", recommendation: "Verificar se a meta é realista e se o lançamento está completo.", internalOnly: true });
  const top = [...m.byCollaborator].sort((a, b) => b.entries - a.entries).slice(0, 10);

  return {
    title: "Relatório de produtividade dos ajudantes",
    executive: [
      kpi("q1", "Ajudantes com lançamento", `${m.collaboratorsLogged} de ${m.collaboratorsScheduled}`, adherence >= 90 ? "good" : adherence >= 70 ? "warn" : "bad", undefined, `${adherence}% dos escalados`),
      kpi("q2", "Lançamentos no mês", String(m.totalEntries), "neutral"),
      kpi("q3", "Sem o lançamento esperado", String(idle.length), idle.length > 0 ? "warn" : "good"),
      kpi("q4", "Metas atingidas (100%)", goals.length ? `${goals.filter((g) => g.percent >= 100).length} de ${goals.length}` : "—", "neutral"),
    ],
    findings,
    sections: [
      sec("pd-visao", "Produção por atividade e tendência", "Lançamentos por pessoa dos ajudantes de armazém e reformadores. Atividade sem unidade (como o 5S) é contada por vezes feitas.", {
        series: [{ title: "Lançamentos por mês", highlightLast: true, points: bucketMonths(months, entries.map((e) => e.date)) }],
        tables: [
          tbl("Produção por atividade", ["Atividade", "Lançamentos", "Quantidade"], m.byActivity.slice(0, 10).map((a) => [a.activityName.replace(/\s*\(.*$/, ""), a.count, a.totalQuantity > 0 ? a.totalQuantity.toLocaleString("pt-BR") : "—"]), { rightAlign: [1, 2] }),
        ],
      }),
      sec("pd-quem", "Quem produz e onde faltam lançamentos", "Ranking por lançamentos e lista de quem não tem o lançamento esperado pela área.", {
        tables: [
          tbl("Ajudantes com mais lançamentos", ["Ajudante", "Área", "Dias lançados", "Dias de trabalho", "Lançamentos"], top.map((x) => [x.name, x.areaName ?? "—", x.daysLogged, x.workDays, x.entries]), { rightAlign: [2, 3, 4], internalOnly: true }),
          tbl("Sem o lançamento esperado", ["Ajudante", "Área", "Atividade esperada"], idle.slice(0, 15).map((x) => [x.name, x.areaName ?? "—", x.expectedActivities.map((a) => a.name.replace(/\s*\(.*$/, "")).join(", ") || "qualquer"]), { internalOnly: true }),
          tbl("Metas do mês", ["Ajudante", "Atividade", "Progresso (%)"], goals.slice(0, 15).map((g) => [g.goal.collaborator.name, g.goal.activity.name.replace(/\s*\(.*$/, ""), g.percent]), { rightAlign: [2], internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Qualificações
export async function buildQualificationsReport(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.QUALIFICATION_MANAGE)) throw new ForbiddenError();
  const now = new Date();
  const months = lastMonths(c.month, 12);
  const [records, activeCollaborators] = await Promise.all([
    db.qualificationRecord.findMany({
      where: { collaborator: { active: true } },
      orderBy: { completedDate: "desc" },
      select: { collaboratorId: true, qualificationTypeId: true, completedDate: true, expiresAt: true, collaborator: { select: { name: true } }, qualificationType: { select: { name: true, category: true } } },
    }),
    db.collaborator.findMany({ where: { active: true }, select: { id: true, name: true, function: { select: { requiresNr: true } } } }),
  ]);
  const seen = new Set<string>();
  const latest = records.filter((r) => {
    const k = `${r.collaboratorId}|${r.qualificationTypeId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const daysLeft = (r: (typeof latest)[number]) => (r.expiresAt ? Math.ceil((r.expiresAt.getTime() - now.getTime()) / 86400000) : null);
  const expired = latest.filter((r) => (daysLeft(r) ?? 1) < 0);
  const exp30 = latest.filter((r) => { const d = daysLeft(r); return d !== null && d >= 0 && d <= 30; });
  const exp90 = latest.filter((r) => { const d = daysLeft(r); return d !== null && d > 30 && d <= 90; });
  const withExpiry = latest.filter((r) => r.expiresAt);
  const validPct = withExpiry.length ? Math.round(((withExpiry.length - expired.length) / withExpiry.length) * 100) : null;
  const holders = (cat: string) => new Set(latest.filter((r) => r.qualificationType.category === cat && (daysLeft(r) ?? 1) >= 0).map((r) => r.collaboratorId));
  const asoOk = holders("ASO");
  const nrAny = new Set(latest.filter((r) => r.qualificationType.category === "NR").map((r) => r.collaboratorId));
  const needNr = activeCollaborators.filter((p) => p.function?.requiresNr !== false);
  const withoutAso = activeCollaborators.filter((p) => !asoOk.has(p.id));
  const withoutNr = needNr.filter((p) => !nrAny.has(p.id));
  const catLabel: Record<string, string> = { NR: "NR", ASO: "ASO", INTEGRACAO: "Integração", CNH: "CNH", OUTRO: "Outro" };
  const byType = new Map<string, { total: number; expired: number; soon: number }>();
  for (const r of latest) {
    const v = byType.get(r.qualificationType.name) ?? { total: 0, expired: 0, soon: 0 };
    v.total++;
    const d = daysLeft(r);
    if (d !== null && d < 0) v.expired++;
    else if (d !== null && d <= 30) v.soon++;
    byType.set(r.qualificationType.name, v);
  }
  const findings: Finding[] = [];
  const asoExpired = expired.filter((r) => r.qualificationType.category === "ASO").length;
  if (asoExpired > 0) findings.push({ severity: "CRITICO", module: "Qualificações", title: `${asoExpired} ASO(s) vencido(s)`, detail: "Colaborador sem exame ocupacional válido não deve exercer a função.", recommendation: "Agendar o exame imediatamente e afastar da atividade até a regularização, conforme a política da empresa." });
  const otherExpired = expired.length - asoExpired;
  if (otherExpired > 0) findings.push({ severity: "ALTO", module: "Qualificações", title: `${otherExpired} qualificação(ões) vencida(s) (NR, integração, CNH ou outras)`, detail: "Treinamentos ou documentos com validade expirada.", recommendation: "Reciclagem priorizada pela criticidade da atividade." });
  if (exp30.length > 0) findings.push({ severity: "ATENCAO", module: "Qualificações", title: `${exp30.length} qualificação(ões) vencendo em até 30 dias`, detail: "Janela curta para agendar a renovação.", recommendation: "Agendar as renovações desta semana." });
  if (withoutAso.length > 0) findings.push({ severity: "ALTO", module: "Qualificações", title: `${withoutAso.length} colaborador(es) sem ASO válido`, detail: "Sem registro de ASO ou com o último vencido.", recommendation: "Conferir se o ASO não foi lançado ou se de fato falta o exame.", internalOnly: true });
  if (withoutNr.length > 0) findings.push({ severity: "ATENCAO", module: "Qualificações", title: `${withoutNr.length} colaborador(es) sem nenhuma NR registrada`, detail: "Função exige NR, mas não há registro no SIGO.", recommendation: "Lançar as NRs já feitas ou agendar o treinamento.", internalOnly: true });

  return {
    title: "Relatório de qualificações e documentos de segurança",
    executive: [
      kpi("n1", "Qualificações vencidas", String(expired.length), expired.length > 0 ? "bad" : "good"),
      kpi("n2", "Vencendo em 30 dias", String(exp30.length), exp30.length > 0 ? "warn" : "good", undefined, `${exp90.length} entre 31 e 90 dias`),
      kpi("n3", "Em validade", validPct === null ? "—" : pct(validPct), validPct === null ? "neutral" : validPct >= 95 ? "good" : validPct >= 85 ? "warn" : "bad", undefined, `${withExpiry.length} com prazo`),
      kpi("n4", "Colaboradores sem ASO válido", String(withoutAso.length), withoutAso.length > 0 ? "bad" : "good", undefined, `de ${activeCollaborators.length} ativos`),
    ],
    findings,
    sections: [
      sec("ql-situacao", "Situação das qualificações", "Registro mais recente de cada colaborador ativo em cada tipo de qualificação. Posição de hoje, não do fim do mês.", {
        series: [{ title: "Qualificações lançadas por mês (data de conclusão)", highlightLast: true, points: bucketMonths(months, records.map((r) => r.completedDate)) }],
        tables: [
          tbl("Por categoria", ["Categoria", "Registros", "Vencidas", "Vencendo em 30 dias"], Object.keys(catLabel).map((k) => { const l = latest.filter((r) => r.qualificationType.category === k); return [catLabel[k], l.length, l.filter((r) => (daysLeft(r) ?? 1) < 0).length, l.filter((r) => { const d = daysLeft(r); return d !== null && d >= 0 && d <= 30; }).length]; }).filter((r) => Number(r[1]) > 0), { rightAlign: [1, 2, 3] }),
          tbl("Por tipo (os que mais vencem)", ["Tipo", "Registros", "Vencidas", "Vencendo em 30 dias"], [...byType.entries()].sort((a, b) => b[1].expired + b[1].soon - (a[1].expired + a[1].soon)).slice(0, 12).map(([n, v]) => [n, v.total, v.expired, v.soon]), { rightAlign: [1, 2, 3] }),
        ],
      }),
      sec("ql-acao", "O que precisa de ação", "Vencidas e a vencer, com o nome de cada colaborador (versão interna).", {
        tables: [
          tbl("Vencidas (mais antigas primeiro)", ["Colaborador", "Qualificação", "Vencida em", "Dias de atraso"], expired.sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime()).slice(0, 20).map((r) => [r.collaborator.name, r.qualificationType.name, dm(r.expiresAt!), Math.abs(daysLeft(r) ?? 0)]), { rightAlign: [3], internalOnly: true }),
          tbl("Vencendo em até 30 dias", ["Colaborador", "Qualificação", "Vence em", "Dias restantes"], exp30.sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime()).slice(0, 20).map((r) => [r.collaborator.name, r.qualificationType.name, dm(r.expiresAt!), daysLeft(r) ?? 0]), { rightAlign: [3], internalOnly: true }),
          tbl("Sem ASO válido", ["Colaborador"], withoutAso.slice(0, 25).map((p) => [p.name]), { internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Presença e faltas
export async function buildAttendanceReport(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.ATTENDANCE_VIEW) && !hasPermission(c.user, PERMISSIONS.SCHEDULE_MANAGE) && !hasPermission(c.user, PERMISSIONS.HR_MANAGE)) throw new ForbiddenError();
  if (!c.internal) throw new Error(NOT_FOR_CLIENT);
  const months = lastMonths(c.month, 12);
  const [notes, active] = await Promise.all([
    db.scheduleDayNote.findMany({
      where: { date: { gte: range(months[0]).start, lt: range(c.month).end }, status: { not: null } },
      select: { date: true, status: true, collaborator: { select: { id: true, name: true, turno: { select: { name: true } }, area: { select: { name: true } } } } },
    }),
    db.collaborator.count({ where: { active: true } }),
  ]);
  const cur = notes.filter((n) => keyOfDate(n.date) === c.month);
  const prev = notes.filter((n) => keyOfDate(n.date) === c.prev);
  const count = (list: typeof notes, s: string) => list.filter((n) => n.status === s).length;
  const falta = count(cur, "FALTA");
  const atest = count(cur, "ATESTADO");
  const per100 = (n: number) => (active ? Math.round((n / active) * 1000) / 10 : null);
  const weekday = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const faltas12 = notes.filter((n) => n.status === "FALTA");
  const wdCounts = countBy(faltas12, (n) => weekday[n.date.getUTCDay()]);
  const byPerson = new Map<string, { name: string; falta: number; atestado: number; turno: string }>();
  for (const n of cur.filter((x) => x.status === "FALTA" || x.status === "ATESTADO")) {
    const v = byPerson.get(n.collaborator.id) ?? { name: n.collaborator.name, falta: 0, atestado: 0, turno: n.collaborator.turno?.name ?? "—" };
    if (n.status === "FALTA") v.falta++;
    else v.atestado++;
    byPerson.set(n.collaborator.id, v);
  }
  const repeat = [...byPerson.values()].filter((v) => v.falta >= 3);
  const statusLabel: Record<string, string> = { FALTA: "Falta", ATESTADO: "Atestado", FERIAS: "Férias", TROCA: "Troca de turno", BH_MAIS: "BH+ (banco positivo)", BH_MENOS: "BH− (folga de banco)", OUTRO: "Outro" };
  const findings: Finding[] = [];
  if (repeat.length > 0) findings.push({ severity: "ALTO", module: "Presença", title: `${repeat.length} colaborador(es) com 3 ou mais faltas no mês`, detail: "Reincidência no mesmo mês.", recommendation: "Aplicar a medida disciplinar da escada e fazer a entrevista de ABS.", internalOnly: true });
  const prevFalta = count(prev, "FALTA");
  if (prevFalta > 0 && falta > prevFalta * 1.3 && falta >= 5) findings.push({ severity: "ATENCAO", module: "Presença", title: "Faltas em alta", detail: `${falta} faltas contra ${prevFalta} no mês anterior.`, recommendation: "Procurar o que concentra o aumento (turno, área, dia da semana) antes de agir de forma geral." });
  const topWd = wdCounts[0];
  if (topWd && faltas12.length >= 20 && topWd[1] / faltas12.length >= 0.3) findings.push({ severity: "ATENCAO", module: "Presença", title: `${Math.round((topWd[1] / faltas12.length) * 100)}% das faltas dos últimos 12 meses caem na ${topWd[0].toLowerCase()}`, detail: "Concentração em um dia da semana indica padrão e não acaso.", recommendation: "Revisar a escala e a cobertura desse dia e conversar com as lideranças." });
  if (cur.length === 0) findings.push({ severity: "INFO", module: "Presença", title: "Nenhuma falta, atestado ou ausência lançada no mês", detail: "Confirme se as chamadas foram feitas todos os dias.", internalOnly: true });

  return {
    title: "Relatório de presença, faltas e atestados",
    executive: [
      kpi("f1", "Faltas", String(falta), trendTone(falta, count(prev, "FALTA"), false), deltaText(falta, count(prev, "FALTA"), "abs")),
      kpi("f2", "Atestados", String(atest), trendTone(atest, count(prev, "ATESTADO"), false), deltaText(atest, count(prev, "ATESTADO"), "abs")),
      kpi("f3", "Faltas por 100 colaboradores", per100(falta) === null ? "—" : String(per100(falta)), "neutral", undefined, `${active} colaboradores ativos`),
      kpi("f4", "Pessoas com 3+ faltas", String(repeat.length), repeat.length > 0 ? "bad" : "good"),
    ],
    findings,
    sections: [
      sec("pf-visao", "Faltas e atestados mês a mês", "Ausências lançadas na escala de trabalho (pela chamada ou pelo RH). Folga e férias não contam como falta.", {
        series: [
          { title: "Faltas por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: notes.filter((n) => keyOfDate(n.date) === m && n.status === "FALTA").length })) },
          { title: "Atestados por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: notes.filter((n) => keyOfDate(n.date) === m && n.status === "ATESTADO").length })) },
        ],
        tables: [
          tbl("Lançamentos do mês por situação", ["Situação", "No mês", "Mês anterior"], Object.keys(statusLabel).map((s) => [statusLabel[s], count(cur, s), count(prev, s)]).filter((r) => Number(r[1]) + Number(r[2]) > 0), { rightAlign: [1, 2] }),
        ],
      }),
      sec("pf-padroes", "Padrões: quando e onde", "Concentração das faltas nos últimos 12 meses por dia da semana e, no mês, por turno e área.", {
        tables: [
          tbl("Faltas por dia da semana (12 meses)", ["Dia", "Faltas"], wdCounts, { rightAlign: [1] }),
          tbl("Faltas e atestados no mês por turno", ["Turno", "Faltas", "Atestados"], [...new Set(cur.map((n) => n.collaborator.turno?.name ?? "Sem turno"))].map((t) => [t, cur.filter((n) => (n.collaborator.turno?.name ?? "Sem turno") === t && n.status === "FALTA").length, cur.filter((n) => (n.collaborator.turno?.name ?? "Sem turno") === t && n.status === "ATESTADO").length]).sort((a, b) => Number(b[1]) - Number(a[1])), { rightAlign: [1, 2] }),
          tbl("Faltas e atestados no mês por área", ["Área", "Faltas", "Atestados"], [...new Set(cur.map((n) => n.collaborator.area?.name ?? "Sem área"))].map((a) => [a, cur.filter((n) => (n.collaborator.area?.name ?? "Sem área") === a && n.status === "FALTA").length, cur.filter((n) => (n.collaborator.area?.name ?? "Sem área") === a && n.status === "ATESTADO").length]).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8), { rightAlign: [1, 2] }),
          tbl("Quem mais se ausentou no mês", ["Colaborador", "Turno", "Faltas", "Atestados"], [...byPerson.values()].sort((a, b) => b.falta - a.falta || b.atestado - a.atestado).slice(0, 12).map((v) => [v.name, v.turno, v.falta, v.atestado]), { rightAlign: [2, 3], internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Medidas disciplinares
export async function buildDisciplineReport(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.HR_MANAGE) && !hasPermission(c.user, PERMISSIONS.DISCIPLINE_MANAGE)) throw new ForbiddenError();
  if (!c.internal) throw new Error(NOT_FOR_CLIENT);
  const months = lastMonths(c.month, 12);
  const rows = await db.disciplinaryMeasure.findMany({
    where: { referenceDate: { gte: range(months[0]).start, lt: range(c.month).end } },
    select: { referenceDate: true, reason: true, step: true, status: true, collaborator: { select: { name: true, turno: { select: { name: true } } } } },
  });
  const cur = rows.filter((r) => keyOfDate(r.referenceDate) === c.month);
  const prev = rows.filter((r) => keyOfDate(r.referenceDate) === c.prev);
  const applied = (l: typeof rows) => l.filter((r) => r.status === "APLICADA");
  const dismissed = cur.filter((r) => r.status === "DISPENSADA");
  const advanced = applied(cur).filter((r) => r.step.startsWith("SUSPENSAO") || r.step === "COMITE");
  const dismissRate = cur.length ? Math.round((dismissed.length / cur.length) * 100) : null;
  const findings: Finding[] = [];
  if (advanced.length > 0) findings.push({ severity: "ALTO", module: "Medidas disciplinares", title: `${advanced.length} medida(s) de suspensão ou comitê no mês`, detail: "Degraus avançados da escada: reincidência após as etapas anteriores.", recommendation: "Revisar se houve acompanhamento nas etapas anteriores e se o caso exige desligamento ou acompanhamento especial.", internalOnly: true });
  if (dismissRate !== null && dismissRate >= 50 && cur.length >= 4) findings.push({ severity: "ATENCAO", module: "Medidas disciplinares", title: `${dismissRate}% das medidas do mês foram dispensadas`, detail: `${dismissed.length} de ${cur.length} ocorrências.`, recommendation: "Conferir se as justificativas são consistentes entre lideranças: dispensa em excesso enfraquece a regra." });
  const turnoCount = countBy(applied(cur), (r) => r.collaborator.turno?.name ?? "Sem turno");
  if (turnoCount[0] && applied(cur).length >= 5 && turnoCount[0][1] / applied(cur).length >= 0.5) findings.push({ severity: "ATENCAO", module: "Medidas disciplinares", title: `Turno ${turnoCount[0][0]} concentra ${Math.round((turnoCount[0][1] / applied(cur).length) * 100)}% das medidas`, detail: "Concentração pode indicar problema de liderança ou de processo no turno.", recommendation: "Conversar com a liderança do turno antes de tratar caso a caso.", internalOnly: true });
  const byPerson = countBy(applied(cur), (r) => r.collaborator.name);

  return {
    title: "Relatório de medidas disciplinares",
    executive: [
      kpi("m1", "Medidas aplicadas", String(applied(cur).length), "neutral", deltaText(applied(cur).length, applied(prev).length, "abs")),
      kpi("m2", "Dispensadas", String(dismissed.length), "neutral", undefined, dismissRate === null ? undefined : `${dismissRate}% das ocorrências`),
      kpi("m3", "Suspensão ou comitê", String(advanced.length), advanced.length > 0 ? "bad" : "good"),
      kpi("m4", "Pessoas atingidas", String(byPerson.length), "neutral"),
    ],
    findings,
    sections: [
      sec("md-visao", "Medidas no mês e tendência", "Medidas disciplinares do checklist não realizado e da falta injustificada (escada de medidas). Contam desde 20/10/2026.", {
        series: [{ title: "Medidas aplicadas por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: applied(rows).filter((r) => keyOfDate(r.referenceDate) === m).length })) }],
        tables: [
          tbl("Por motivo", ["Motivo", "Aplicadas", "Dispensadas"], ["CHECKLIST", "FALTA"].map((k) => [disciplineReasonLabel(k), cur.filter((r) => r.reason === k && r.status === "APLICADA").length, cur.filter((r) => r.reason === k && r.status === "DISPENSADA").length]), { rightAlign: [1, 2] }),
          tbl("Por degrau da escada", ["Medida", "Aplicadas no mês"], countBy(applied(cur), (r) => disciplineStepLabel(r.step)), { rightAlign: [1] }),
          tbl("Por turno", ["Turno", "Aplicadas"], turnoCount, { rightAlign: [1] }),
        ],
      }),
      sec("md-quem", "Quem foi atingido", "Nomes apenas na versão interna.", {
        tables: [tbl("Colaboradores com medidas no mês", ["Colaborador", "Medidas"], byPerson.slice(0, 15), { rightAlign: [1], internalOnly: true })],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Financeiro (DRE)
export async function buildFinanceReport(c: DetailCtx): Promise<Out> {
  if (!c.internal) throw new Error(NOT_FOR_CLIENT);
  if (!hasPermission(c.user, PERMISSIONS.HR_MANAGE)) throw new ForbiddenError();
  const dre = await getDreView(c.user);
  if (!dre.ready || !dre.months.includes(c.month)) throw new Error("Não há DRE importado para este mês.");
  const cell = (l: (typeof dre.lines)[number], m: string) => l.byMonth[m] ?? null;
  const revenue = dre.lines.find((l) => l.code === "001");
  const cur = revenue ? cell(revenue, c.month) : null;
  const prevCell = revenue ? cell(revenue, c.prev) : null;
  const lines = dre.lines.filter((l) => cell(l, c.month));
  const rank = [...lines].filter((l) => l.level <= 2).sort((a, b) => Math.abs(cell(b, c.month)![2]) - Math.abs(cell(a, c.month)![2])).slice(0, 10);
  const ytdYear = c.month.slice(0, 4);
  const ytdMonths = dre.months.filter((m) => m.startsWith(ytdYear) && m <= c.month);
  const months = dre.months.filter((m) => m <= c.month).slice(-12);
  const findings: Finding[] = [];
  if (cur && prevCell && prevCell[1] > 0 && cur[1] < prevCell[1] * 0.9) findings.push({ severity: "ATENCAO", module: "Financeiro", title: "Receita realizada abaixo do mês anterior", detail: `${brl(cur[1])} contra ${brl(prevCell[1])} (${Math.round(((cur[1] - prevCell[1]) / prevCell[1]) * 100)}%).`, recommendation: "Cruzar com o volume de carros carregados e com os dias de operação do mês.", internalOnly: true });
  const heavy = rank[0];
  if (heavy) findings.push({ severity: "INFO", module: "Financeiro", title: `Maior diferença entre realizado e remunerado: ${heavy.name}`, detail: `Diferença de ${brl(cell(heavy, c.month)![2])} no mês.`, internalOnly: true });

  return {
    title: "Relatório financeiro — DRE da operação",
    executive: [
      kpi("r1", "Receita realizada", cur ? brl(cur[1]) : "—", cur && prevCell ? trendTone(cur[1], prevCell[1], true) : "neutral", cur && prevCell ? deltaText(cur[1], prevCell[1], "pct") : undefined),
      kpi("r2", "Receita remunerada", cur ? brl(cur[0]) : "—", "neutral"),
      kpi("r3", "Diferença (realizado − remunerado)", cur ? brl(cur[2]) : "—", "neutral"),
      kpi("r4", "Linhas do DRE no mês", String(lines.length), "neutral"),
    ],
    findings,
    sections: [
      sec("fi-visao", "Resultado do mês e do ano", `DRE importado (${dre.meta?.unit ?? "unidade"}). Remunerado é o valor previsto/contratual; realizado é o efetivamente apurado; AVR é a participação sobre a receita.`, {
        series: revenue ? [{ title: "Receita realizada por mês (R$ mil)", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: Math.round((cell(revenue, m)?.[1] ?? 0) / 1000) })) }] : [],
        tables: [
          tbl("Linhas com maior diferença no mês", ["Linha", "Remunerado", "Realizado", "Diferença", "AVR (%)"], rank.map((l) => { const x = cell(l, c.month)!; return [l.name, brl(x[0]), brl(x[1]), brl(x[2]), Math.round(x[3] * 10) / 10]; }), { rightAlign: [1, 2, 3, 4], note: "A diferença é realizado menos remunerado; a leitura de favorável ou desfavorável depende de a linha ser receita ou custo." }),
          tbl(`Acumulado de ${ytdYear} (principais linhas)`, ["Linha", "Remunerado", "Realizado", "Diferença", "AVR (%)"], dre.lines.filter((l) => l.level <= 1 && ytdMonths.length > 0).slice(0, 12).map((l) => [l.name, brl(l.ytd[0]), brl(l.ytd[1]), brl(l.ytd[2]), Math.round(l.ytd[3] * 10) / 10]), { rightAlign: [1, 2, 3, 4] }),
        ],
      }),
    ],
  };
}

void daysBetween;
