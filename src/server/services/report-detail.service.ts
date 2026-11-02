import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listDtoOfMonth } from "@/server/services/dto.service";
import { compliancePercent, getChecklistComplianceDashboard } from "@/server/services/checklist-compliance.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { classifyAnswer } from "@/domain/dto/answers";
import { deltaText, dtoFindings, kpi, nonconformityFindings, sortFindings, trendTone, checklistFindings } from "@/domain/reports/analysis";
import type { Finding, MonthlyReport, ReportKind, ReportVersion } from "@/domain/reports/types";
import { daysBetween, lastMonths, monthLabelOf, num, pct, range, shiftMonth, shortLabel } from "@/server/services/report.service";
import { buildAccidentsReport, buildGuardianReport, buildTmaReport } from "@/server/services/report-detail-b.service";
import { buildAttendanceReport, buildDisciplineReport, buildFinanceReport, buildProductionReport, buildProductivityReport, buildQualificationsReport } from "@/server/services/report-detail-c.service";
import { avgOf, countBy, keyOfDate, sec, tbl, type DetailCtx, type Out } from "@/server/services/report-kit";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/dates";

// ------------------------------------------------------------------------------------------------ DTO
async function buildDto(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.DTO_MANAGE) && !hasPermission(c.user, PERMISSIONS.DTO_VIEW)) throw new ForbiddenError();
  const months = lastMonths(c.month, 12);
  const [cur, prev, trendRows, eligible] = await Promise.all([
    listDtoOfMonth(c.user, c.month),
    listDtoOfMonth(c.user, c.prev),
    db.dtoEvaluation.findMany({ where: { date: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { date: true, scorePercent: true } }),
    db.collaborator.count({ where: { active: true, OR: [{ function: null }, { function: { dtoExempt: false } }] } }),
  ]);
  const scores = cur.map((d) => d.scorePercent).filter((n): n is number => n !== null);
  const avg = avgOf(scores);
  const prevAvg = avgOf(prev.map((d) => d.scorePercent).filter((n): n is number => n !== null));
  const below60 = scores.filter((s) => s < 60).length;
  const withNo = cur.filter((d) => d.noCount > 0).length;
  const evaluated = new Set(cur.map((d) => d.collaboratorId)).size;
  const coverage = eligible > 0 ? Math.round((evaluated / eligible) * 100) : null;

  // Itens mais reprovados: cada pergunta com seus "não" e a taxa de reprovação.
  const items = new Map<string, { yes: number; no: number }>();
  for (const d of cur) {
    for (const a of d.answers) {
      const kind = classifyAnswer(a.a);
      if (kind !== "yes" && kind !== "no") continue;
      const it = items.get(a.q) ?? { yes: 0, no: 0 };
      if (kind === "yes") it.yes++;
      else it.no++;
      items.set(a.q, it);
    }
  }
  const itemRows = [...items.entries()].filter(([, v]) => v.no > 0).map(([q, v]) => [q.length > 90 ? `${q.slice(0, 87)}…` : q, v.no, v.yes + v.no, Math.round((v.no / (v.yes + v.no)) * 100)] as (string | number)[]).sort((a, b) => Number(b[3]) - Number(a[3]) || Number(b[1]) - Number(a[1]));

  const byActivity = new Map<string, DtoLite[]>();
  for (const d of cur) byActivity.set(d.activity, [...(byActivity.get(d.activity) ?? []), d]);
  const activityRows = [...byActivity.entries()]
    .map(([a, list]) => [a, list.length, avgOf(list.map((x) => x.scorePercent).filter((n): n is number => n !== null)) ?? 0, list.reduce((s, x) => s + x.noCount, 0)] as (string | number)[])
    .sort((a, b) => Number(a[2]) - Number(b[2]));

  const byEvaluator = new Map<string, DtoLite[]>();
  for (const d of cur) byEvaluator.set(d.evaluatorName ?? "(sem avaliador)", [...(byEvaluator.get(d.evaluatorName ?? "(sem avaliador)") ?? []), d]);
  const evaluatorRows = [...byEvaluator.entries()].map(([n, list]) => [n, list.length, avgOf(list.map((x) => x.scorePercent).filter((v): v is number => v !== null)) ?? 0] as (string | number)[]).sort((a, b) => Number(b[1]) - Number(a[1]));

  const buckets: [string, (s: number) => boolean][] = [["Abaixo de 60%", (s) => s < 60], ["60% a 79%", (s) => s >= 60 && s < 80], ["80% a 89%", (s) => s >= 80 && s < 90], ["90% a 100%", (s) => s >= 90]];
  const trend = new Map<string, number[]>();
  const trendCount = new Map<string, number>();
  for (const r of trendRows) {
    const k = keyOfDate(r.date);
    trendCount.set(k, (trendCount.get(k) ?? 0) + 1);
    if (r.scorePercent !== null) trend.set(k, [...(trend.get(k) ?? []), r.scorePercent]);
  }

  const findings = dtoFindings({ count: cur.length, avgScore: avg, prevAvg, below60 });
  if (coverage !== null && coverage < 50 && cur.length > 0) findings.push({ severity: "ATENCAO", module: "DTO", title: `Só ${coverage}% das pessoas foram avaliadas no mês`, detail: `${evaluated} de ${eligible} colaboradores cobertos pelo DTO.`, recommendation: "Distribuir as avaliações pelas lideranças de cada turno para cobrir todos em até dois meses." });
  const worstItem = itemRows[0];
  if (worstItem && Number(worstItem[3]) >= 30 && Number(worstItem[2]) >= 5) findings.push({ severity: "ATENCAO", module: "DTO", title: "Item com alta taxa de reprovação", detail: `"${worstItem[0]}": ${worstItem[3]}% de "não" em ${worstItem[2]} respostas.`, recommendation: "Reforçar esse ponto no diálogo de segurança dos turnos." });

  return {
    title: "Relatório de DTO — observação de comportamento",
    executive: [
      kpi("d1", "Avaliações", String(cur.length), "neutral", deltaText(cur.length, prev.length, "abs")),
      kpi("d2", "Nota média", avg === null ? "—" : pct(avg), avg === null ? "neutral" : avg >= 90 ? "good" : avg >= 80 ? "warn" : "bad", deltaText(avg, prevAvg, "pts")),
      kpi("d3", "Com pelo menos um \"não\"", cur.length ? pct(Math.round((withNo / cur.length) * 100)) : "—", "neutral"),
      kpi("d4", "Cobertura de pessoas", coverage === null ? "—" : pct(coverage), coverage === null ? "neutral" : coverage >= 50 ? "good" : "warn", undefined, `${evaluated} de ${eligible}`),
    ],
    findings,
    sections: [
      sec("dto-geral", "Visão geral e tendência", "Avaliações de DTO importadas. Nota = itens \"sim\" ÷ (sim + não); N/A e respostas abertas não contam.", {
        kpis: [kpi("d5", "Notas abaixo de 60%", String(below60), below60 > 0 ? "bad" : "good"), kpi("d6", "Melhor nota", scores.length ? pct(Math.max(...scores)) : "—", "neutral"), kpi("d7", "Pior nota", scores.length ? pct(Math.min(...scores)) : "—", "neutral")],
        series: [
          { title: "Nota média por mês (%)", unit: "%", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: avgOf(trend.get(m) ?? []) ?? 0 })) },
          { title: "Avaliações por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: trendCount.get(m) ?? 0 })) },
        ],
        tables: [tbl("Distribuição das notas", ["Faixa", "Avaliações", "%"], buckets.map(([l, f]) => [l, scores.filter(f).length, scores.length ? Math.round((scores.filter(f).length / scores.length) * 100) : 0]), { rightAlign: [1, 2] })],
      }),
      sec("dto-itens", "Onde o comportamento falha", "Perguntas do DTO com mais respostas \"não\" no mês, e as atividades com pior nota.", {
        tables: [
          tbl("Itens mais reprovados", ["Item", "Não", "Respostas", "Taxa de não (%)"], itemRows.slice(0, 12), { rightAlign: [1, 2, 3] }),
          tbl("Atividades (da pior para a melhor nota)", ["Atividade", "Avaliações", "Nota média (%)", "Itens \"não\""], activityRows.slice(0, 12), { rightAlign: [1, 2, 3] }),
        ],
      }),
      sec("dto-quem", "Quem avalia e quem foi avaliado", "Útil para ver se há avaliador muito brando ou muito rígido, e quem precisa de acompanhamento.", {
        tables: [
          tbl("Avaliadores", ["Avaliador", "Avaliações", "Nota média dada (%)"], evaluatorRows.slice(0, 10), { rightAlign: [1, 2], internalOnly: true }),
          tbl("Menores notas do mês", ["Colaborador", "Data", "Atividade", "Nota (%)"], cur.filter((d) => d.scorePercent !== null).sort((a, b) => a.scorePercent! - b.scorePercent!).slice(0, 10).map((d) => [d.collaboratorName, `${d.date.toISOString().slice(8, 10)}/${d.date.toISOString().slice(5, 7)}`, d.activity, Math.round(d.scorePercent!)]), { rightAlign: [3], internalOnly: true }),
        ],
      }),
    ],
  };
}
type DtoLite = Awaited<ReturnType<typeof listDtoOfMonth>>[number];

// ------------------------------------------------------------------------------------------------ Equipamentos
async function buildEquipments(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.EQUIPMENT_VIEW) && !hasPermission(c.user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) throw new ForbiddenError();
  const now = new Date();
  const months = lastMonths(c.month, 12);
  const [equipments, openNcs, lastExec, blockedEvents, execs, newNcs, risk] = await Promise.all([
    db.equipment.findMany({ where: { active: true }, select: { id: true, code: true, name: true, status: true, criticality: true, type: { select: { name: true } }, area: { select: { name: true } }, assignments: { where: { active: true }, select: { id: true } } } }),
    db.nonconformity.findMany({ where: { status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } }, select: { equipmentId: true, severity: true, identifiedAt: true } }),
    db.checklistExecution.groupBy({ by: ["equipmentId"], where: { status: "CONCLUIDO" }, _max: { finishedAt: true } }),
    db.equipmentEvent.findMany({ where: { type: "EQUIPAMENTO_BLOQUEADO" }, orderBy: { occurredAt: "desc" }, select: { equipmentId: true, occurredAt: true } }),
    db.checklistExecution.findMany({ where: { status: "CONCLUIDO", finishedAt: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { finishedAt: true, result: true } }),
    db.nonconformity.findMany({ where: { identifiedAt: { gte: range(months[0]).start, lt: range(c.month).end } }, select: { identifiedAt: true } }),
    getEquipmentRiskRanking(c.user, 10).catch(() => []),
  ]);
  const statusLabel: Record<string, string> = { LIBERADO: "Liberado", LIBERADO_COM_OBSERVACAO: "Liberado com observação", RESTRITO: "Restrito", BLOQUEADO: "Bloqueado", EM_MANUTENCAO: "Em manutenção", INATIVO: "Inativo" };
  const lastExecBy = new Map(lastExec.map((l) => [l.equipmentId, l._max.finishedAt]));
  const blockedSince = new Map<string, Date>();
  for (const e of blockedEvents) if (!blockedSince.has(e.equipmentId)) blockedSince.set(e.equipmentId, e.occurredAt);
  const ncByEq = new Map<string, { n: number; crit: number; oldest: Date }>();
  for (const n of openNcs) {
    const cur = ncByEq.get(n.equipmentId) ?? { n: 0, crit: 0, oldest: n.identifiedAt };
    cur.n++;
    if (n.severity === "CRITICA") cur.crit++;
    if (n.identifiedAt < cur.oldest) cur.oldest = n.identifiedAt;
    ncByEq.set(n.equipmentId, cur);
  }
  const withChecklist = equipments.filter((e) => e.assignments.length > 0);
  const stale = withChecklist
    .map((e) => ({ e, last: lastExecBy.get(e.id) ?? null }))
    .filter((x) => x.e.status !== "BLOQUEADO" && (!x.last || daysBetween(x.last, now) >= 7))
    .sort((a, b) => (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));
  const blocked = equipments.filter((e) => e.status === "BLOQUEADO");
  const notReleased = equipments.filter((e) => e.status !== "LIBERADO").length;
  const execByMonth = new Map<string, { total: number; fail: number }>();
  for (const e of execs) {
    const k = keyOfDate(e.finishedAt!);
    const v = execByMonth.get(k) ?? { total: 0, fail: 0 };
    v.total++;
    if (e.result && e.result !== "LIBERADO") v.fail++;
    execByMonth.set(k, v);
  }
  const ncMonth = countBy(newNcs, (n) => keyOfDate(n.identifiedAt));
  const curExec = execByMonth.get(c.month) ?? { total: 0, fail: 0 };
  const prevExec = execByMonth.get(c.prev) ?? { total: 0, fail: 0 };
  const failRate = curExec.total ? Math.round((curExec.fail / curExec.total) * 100) : null;
  const prevFailRate = prevExec.total ? Math.round((prevExec.fail / prevExec.total) * 100) : null;

  const findings: Finding[] = nonconformityFindings({ openCritical: openNcs.filter((n) => n.severity === "CRITICA").length, oldestCriticalDays: null, openOver30: 0, openTotal: openNcs.length, withoutResponsible: 0, overdueActions: 0, blockedEquipments: blocked.length }).filter((f) => f.module === "Equipamentos" || f.module === "Não conformidades");
  if (stale.length > 0) findings.push({ severity: "ALTO", module: "Equipamentos", title: `${stale.length} equipamento(s) com checklist e sem execução há 7 dias ou mais`, detail: "Têm checklist configurado, mas ninguém inspecionou na última semana.", recommendation: "Conferir se estão em uso e quem é o responsável por inspecionar; se não estão, inativar." });
  const repeat = [...ncByEq.entries()].filter(([, v]) => v.n >= 3);
  if (repeat.length > 0) findings.push({ severity: "ALTO", module: "Equipamentos", title: `${repeat.length} equipamento(s) com 3 ou mais NCs abertas`, detail: "Concentração de problemas no mesmo ativo.", recommendation: "Avaliar manutenção corretiva completa ou substituição em vez de tratar NC por NC." });
  if (failRate !== null && prevFailRate !== null && failRate - prevFailRate >= 5) findings.push({ severity: "ATENCAO", module: "Equipamentos", title: "Mais checklists com desvio que no mês anterior", detail: `${failRate}% dos checklists terminaram com restrição ou bloqueio, contra ${prevFailRate}%.` });

  const eqName = (id: string) => equipments.find((e) => e.id === id);
  return {
    title: "Relatório de equipamentos",
    executive: [
      kpi("e1", "Equipamentos ativos", String(equipments.length), "neutral"),
      kpi("e2", "Não liberados", String(notReleased), notReleased > 0 ? "warn" : "good", undefined, `${blocked.length} bloqueado(s)`),
      kpi("e3", "Checklists no mês", String(curExec.total), "neutral", deltaText(curExec.total, prevExec.total, "pct")),
      kpi("e4", "Checklists com desvio", failRate === null ? "—" : pct(failRate), trendTone(failRate, prevFailRate, false), deltaText(failRate, prevFailRate, "pts")),
    ],
    findings: sortFindings(findings),
    sections: [
      sec("eq-parque", "Parque de equipamentos", "Todos os equipamentos ativos do SIGO, por situação, área e tipo.", {
        kpis: [kpi("e5", "Com checklist configurado", String(withChecklist.length), "neutral"), kpi("e6", "Sem checklist", String(equipments.length - withChecklist.length), equipments.length - withChecklist.length > 0 ? "warn" : "good")],
        series: [
          { title: "Checklists concluídos por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: execByMonth.get(m)?.total ?? 0 })) },
          { title: "NCs novas por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: ncMonth.find(([k]) => k === m)?.[1] ?? 0 })) },
        ],
        tables: [
          tbl("Por situação", ["Situação", "Equipamentos"], countBy(equipments, (e) => statusLabel[e.status] ?? e.status), { rightAlign: [1] }),
          tbl("Por área", ["Área", "Equipamentos", "Bloqueados"], countBy(equipments, (e) => e.area.name).map(([a, n]) => [a, n, equipments.filter((e) => e.area.name === a && e.status === "BLOQUEADO").length]), { rightAlign: [1, 2] }),
          tbl("Por tipo", ["Tipo", "Equipamentos"], countBy(equipments, (e) => e.type.name).slice(0, 10), { rightAlign: [1] }),
        ],
      }),
      sec("eq-risco", "Onde está o risco", "Ranking de risco do SIGO (histórico de falhas e NCs) e concentração de NCs abertas por equipamento.", {
        tables: [
          tbl("Maior risco", ["Equipamento", "Nome", "Área", "Pontuação de risco"], risk.map((r) => [r.equipmentCode, r.equipmentName, r.areaName, Math.round(r.score)]), { rightAlign: [3] }),
          tbl("NCs abertas por equipamento", ["Equipamento", "Nome", "NCs abertas", "Críticas", "Mais antiga (dias)"], [...ncByEq.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => [eqName(id)?.code ?? "—", eqName(id)?.name ?? "—", v.n, v.crit, daysBetween(v.oldest, now)]), { rightAlign: [2, 3, 4] }),
        ],
      }),
      sec("eq-controle", "Controle: bloqueios e inspeção em dia", "Equipamentos bloqueados e há quanto tempo, e os que têm checklist mas ninguém inspeciona.", {
        tables: [
          tbl("Bloqueados", ["Equipamento", "Nome", "Área", "Bloqueado há (dias)"], blocked.map((e) => [e.code, e.name, e.area.name, blockedSince.get(e.id) ? daysBetween(blockedSince.get(e.id)!, now) : "—"]), { rightAlign: [3] }),
          tbl("Sem inspeção há 7 dias ou mais", ["Equipamento", "Nome", "Área", "Última execução"], stale.slice(0, 12).map((x) => [x.e.code, x.e.name, x.e.area.name, x.last ? `${daysBetween(x.last, now)} dias atrás` : "nunca"]), { note: "Considera só equipamentos com checklist configurado e que não estão bloqueados." }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Checklists
async function buildChecklists(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) throw new ForbiddenError();
  const isCurrent = c.month === c.nowKey;
  const trendMonths = lastMonths(c.month, 4);
  const dashboards = await Promise.all(trendMonths.map((m) => getChecklistComplianceDashboard(c.user, { month: m })));
  const cur = dashboards[dashboards.length - 1];
  const prev = dashboards[dashboards.length - 2];
  const p = compliancePercent(cur.month);
  const pp = compliancePercent(prev.month);
  const { start, end } = range(c.month);
  const [execs, failing, answered] = await Promise.all([
    db.checklistExecution.findMany({ where: { status: "CONCLUIDO", finishedAt: { gte: start, lt: end } }, select: { finishedAt: true, result: true, delayMinutes: true } }),
    db.checklistAnswer.groupBy({ by: ["questionId"], where: { value: "NAO_CONFORME", execution: { status: "CONCLUIDO", finishedAt: { gte: start, lt: end } } }, _count: true }),
    db.checklistAnswer.groupBy({ by: ["questionId"], where: { execution: { status: "CONCLUIDO", finishedAt: { gte: start, lt: end } } }, _count: true }),
  ]);
  const topFail = failing.sort((a, b) => b._count - a._count).slice(0, 10);
  const titles = await db.checklistQuestion.findMany({ where: { id: { in: topFail.map((f) => f.questionId) } }, select: { id: true, title: true } });
  const titleOf = new Map(titles.map((t) => [t.id, t.title]));
  const totalOf = new Map(answered.map((a) => [a.questionId, a._count]));
  const resultLabel: Record<string, string> = { LIBERADO: "Liberado", LIBERADO_COM_OBSERVACAO: "Liberado com observação", RESTRITO: "Restrito", BLOQUEADO: "Bloqueado" };
  const people = cur.month.people;
  const byArea = new Map<string, { req: number; done: number }>();
  for (const x of people) {
    const a = x.areaName ?? "Sem área";
    const v = byArea.get(a) ?? { req: 0, done: 0 };
    v.req += x.shiftsRequired;
    v.done += x.shiftsComplete;
    byArea.set(a, v);
  }
  const pending = cur.month.shiftsRequired - cur.month.shiftsComplete;
  const perDay = countBy(execs, (e) => String(e.finishedAt!.getUTCDate()).padStart(2, "0"));
  const delays = execs.map((e) => e.delayMinutes).filter((d): d is number => d !== null && d > 0);
  const findings = checklistFindings({ percent: p, prevPercent: pp, pendingShifts: pending, isCurrentMonth: isCurrent });
  const heavy = people.filter((x) => x.shiftsRequired - x.shiftsComplete >= 5);
  if (heavy.length > 0) findings.push({ severity: "ATENCAO", module: "Checklists", title: `${heavy.length} pessoa(s) com 5 ou mais turnos pendentes`, detail: "Concentram a maior parte das pendências do mês.", recommendation: "Conversa individual e checagem de acesso: pode ser falta de login ou de checklist configurado.", internalOnly: true });
  const noAccess = people.filter((x) => x.noAccess).length;
  if (noAccess > 0) findings.push({ severity: "ATENCAO", module: "Checklists", title: `${noAccess} pessoa(s) cobrada(s) sem acesso ao sistema`, detail: "Não conseguem cumprir porque não têm login.", recommendation: "Criar os acessos ou retirar a cobrança de quem não precisa." });

  return {
    title: "Relatório de checklists — aderência por colaborador",
    executive: [
      kpi("k1", "Aderência", p === null ? "—" : pct(p), p === null ? "neutral" : p >= 95 ? "good" : p >= 85 ? "warn" : "bad", deltaText(p, pp, "pts")),
      kpi("k2", "Turnos cumpridos", `${cur.month.shiftsComplete} de ${cur.month.shiftsRequired}`, "neutral"),
      kpi("k3", "Turnos pendentes", String(pending), pending > 0 ? "warn" : "good"),
      kpi("k4", "Checklists concluídos", String(execs.length), "neutral"),
    ],
    findings: sortFindings(findings),
    sections: [
      sec("ck-adesao", "Aderência: quem cumpre e quem não", `Turnos em que a pessoa era cobrada por checklist e quantos cumpriu${isCurrent ? " (mês em andamento, até ontem)" : ""}. Usa a lista de colaboradores e as exigências de hoje.`, {
        kpis: [kpi("k5", "Em dia", `${cur.month.collaboratorsComplete} de ${cur.month.collaboratorsScheduled}`, "neutral"), kpi("k6", "Sem acesso", String(noAccess), noAccess > 0 ? "warn" : "good")],
        series: [{ title: "Aderência por mês (%)", unit: "%", highlightLast: true, points: trendMonths.map((m, i) => ({ label: shortLabel(m), value: compliancePercent(dashboards[i].month) ?? 0 })) }],
        tables: [
          tbl("Por área", ["Área", "Cobrados", "Cumpridos", "Aderência (%)"], [...byArea.entries()].map(([a, v]) => [a, v.req, v.done, v.req ? Math.round((v.done / v.req) * 100) : 0]).sort((a, b) => Number(a[3]) - Number(b[3])), { rightAlign: [1, 2, 3] }),
          tbl("Quem mais deixou de cumprir", ["Colaborador", "Área", "Cobrados", "Cumpridos", "Pendentes"], [...people].filter((x) => x.shiftsRequired > x.shiftsComplete).sort((a, b) => b.shiftsRequired - b.shiftsComplete - (a.shiftsRequired - a.shiftsComplete)).slice(0, 12).map((x) => [x.name, x.areaName ?? "—", x.shiftsRequired, x.shiftsComplete, x.shiftsRequired - x.shiftsComplete]), { rightAlign: [2, 3, 4], internalOnly: true }),
        ],
      }),
      sec("ck-exec", "O que os checklists encontraram", "Execuções concluídas no mês: resultado, ritmo diário e as perguntas com mais respostas \"não conforme\".", {
        series: [{ title: "Checklists concluídos por dia", highlightLast: false, points: perDay.sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => ({ label: d, value: n })) }],
        kpis: [kpi("k7", "Atraso médio", delays.length ? `${Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)} min` : "—", "neutral", undefined, `${delays.length} execução(ões) com atraso`)],
        tables: [
          tbl("Resultado das execuções", ["Resultado", "Execuções"], countBy(execs, (e) => resultLabel[e.result ?? ""] ?? "Sem resultado"), { rightAlign: [1] }),
          tbl("Perguntas mais reprovadas", ["Pergunta", "Não conforme", "Respostas", "Taxa (%)"], topFail.map((f) => [(titleOf.get(f.questionId) ?? "—").slice(0, 90), f._count, totalOf.get(f.questionId) ?? 0, totalOf.get(f.questionId) ? Math.round((f._count / (totalOf.get(f.questionId) as number)) * 100) : 0]), { rightAlign: [1, 2, 3] }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ Não conformidades
async function buildNcs(c: DetailCtx): Promise<Out> {
  if (!hasPermission(c.user, PERMISSIONS.NONCONFORMITY_VIEW) && !hasPermission(c.user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) throw new ForbiddenError();
  const now = new Date();
  const months = lastMonths(c.month, 12);
  const all = await db.nonconformity.findMany({
    select: { code: true, severity: true, status: true, identifiedAt: true, dueDate: true, responsibleId: true, equipmentId: true, originAnswer: { select: { questionId: true } }, equipment: { select: { code: true } }, area: { select: { name: true } }, faultCategory: { select: { name: true } }, actionPlan: { select: { items: { select: { status: true, dueDate: true } } } } },
  });
  const closed = ["CONCLUIDA", "ENCERRADA", "CANCELADA"];
  const open = all.filter((n) => !closed.includes(n.status));
  const { start, end } = range(c.month);
  const prevR = range(c.prev);
  const openedNow = all.filter((n) => n.identifiedAt >= start && n.identifiedAt < end).length;
  const openedPrev = all.filter((n) => n.identifiedAt >= prevR.start && n.identifiedAt < prevR.end).length;
  const age = (n: { identifiedAt: Date }) => daysBetween(n.identifiedAt, now);
  const critical = open.filter((n) => n.severity === "CRITICA");
  const statusLabel: Record<string, string> = { ABERTA: "Aberta", EM_ANALISE: "Em análise", ACAO_DEFINIDA: "Ação definida", EM_EXECUCAO: "Em execução", AGUARDANDO_VERIFICACAO: "Aguardando verificação", CONCLUIDA: "Concluída", ENCERRADA: "Encerrada", CANCELADA: "Cancelada" };
  const sevLabel: Record<string, string> = { CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
  const buckets: [string, (d: number) => boolean][] = [["Até 7 dias", (d) => d <= 7], ["8 a 30 dias", (d) => d > 7 && d <= 30], ["31 a 60 dias", (d) => d > 30 && d <= 60], ["Mais de 60 dias", (d) => d > 60]];
  const overdueDue = open.filter((n) => n.dueDate && n.dueDate < now).length;
  const withoutResp = open.filter((n) => !n.responsibleId).length;
  const items = open.flatMap((n) => n.actionPlan?.items ?? []);
  const overdueItems = items.filter((i) => i.dueDate < now && ["PENDENTE", "EM_ANDAMENTO", "VENCIDA"].includes(i.status)).length;
  const emptyPlans = open.filter((n) => (n.actionPlan?.items.length ?? 0) === 0).length;
  // Repetição: mesma pergunta reprovada no mesmo equipamento gera NCs separadas.
  const groups = new Map<string, number>();
  for (const n of open) if (n.originAnswer) groups.set(`${n.equipmentId}|${n.originAnswer.questionId}`, (groups.get(`${n.equipmentId}|${n.originAnswer.questionId}`) ?? 0) + 1);
  const repeatedGroups = [...groups.values()].filter((v) => v > 1);
  const repeatedNcs = repeatedGroups.reduce((s, v) => s + v, 0);
  const findings = nonconformityFindings({ openCritical: critical.length, oldestCriticalDays: critical.length ? Math.max(...critical.map(age)) : null, openOver30: open.filter((n) => age(n) > 30).length, openTotal: open.length, withoutResponsible: withoutResp, overdueActions: overdueItems, blockedEquipments: 0 }).filter((f) => f.module !== "Equipamentos");
  if (repeatedGroups.length > 0) findings.push({ severity: "ATENCAO", module: "Não conformidades", title: `${repeatedNcs} NCs abertas repetem a mesma pergunta no mesmo equipamento`, detail: `${repeatedGroups.length} grupo(s) de NCs que podem ser o mesmo defeito: cada checklist reprovado cria uma NC nova.`, recommendation: "Agrupar por defeito: uma NC, um plano e uma validação por problema real." });
  if (emptyPlans > 0) findings.push({ severity: "ALTO", module: "Planos de ação", title: `${emptyPlans} NC(s) abertas com plano de ação vazio`, detail: "Criadas automaticamente pelo checklist, mas sem nenhuma ação definida.", recommendation: "Definir ao menos uma ação com responsável e prazo para cada NC." });
  const perMonth = countBy(all, (n) => keyOfDate(n.identifiedAt));
  const byEquip = countBy(open, (n) => n.equipment.code).slice(0, 8);

  return {
    title: "Relatório de não conformidades e planos de ação",
    executive: [
      kpi("n1", "NCs abertas hoje", String(open.length), open.length === 0 ? "good" : "warn"),
      kpi("n2", "NCs críticas", String(critical.length), critical.length > 0 ? "bad" : "good"),
      kpi("n3", "NCs novas no mês", String(openedNow), trendTone(openedNow, openedPrev, false), deltaText(openedNow, openedPrev, "abs")),
      kpi("n4", "Ações vencidas", String(overdueItems), overdueItems > 0 ? "bad" : "good"),
    ],
    findings: sortFindings(findings),
    sections: [
      sec("nc-estoque", "Estoque de NCs abertas", "Posição de HOJE: o sistema não guarda a data de encerramento, então não há foto de fim de mês.", {
        kpis: [kpi("n5", "Sem responsável", String(withoutResp), withoutResp > 0 ? "warn" : "good"), kpi("n6", "Prazo vencido", String(overdueDue), overdueDue > 0 ? "bad" : "good"), kpi("n7", "Plano de ação vazio", String(emptyPlans), emptyPlans > 0 ? "bad" : "good")],
        series: [{ title: "NCs criadas por mês", highlightLast: true, points: months.map((m) => ({ label: shortLabel(m), value: perMonth.find(([k]) => k === m)?.[1] ?? 0 })) }],
        tables: [
          tbl("Por situação (todas as abertas)", ["Situação", "NCs"], countBy(open, (n) => statusLabel[n.status] ?? n.status), { rightAlign: [1] }),
          tbl("Por severidade", ["Severidade", "NCs"], ["CRITICA", "ALTA", "MEDIA", "BAIXA"].map((s) => [sevLabel[s], open.filter((n) => n.severity === s).length]).filter((r) => Number(r[1]) > 0), { rightAlign: [1] }),
          tbl("Tempo em aberto", ["Faixa", "NCs"], buckets.map(([l, f]) => [l, open.filter((n) => f(age(n))).length]), { rightAlign: [1] }),
        ],
      }),
      sec("nc-onde", "Onde se concentram", "Áreas, categorias de falha e equipamentos com mais NCs abertas.", {
        tables: [
          tbl("Por área", ["Área", "NCs abertas"], countBy(open, (n) => n.area.name).slice(0, 8), { rightAlign: [1] }),
          tbl("Por categoria de falha", ["Categoria", "NCs abertas"], countBy(open, (n) => n.faultCategory?.name ?? "Sem categoria").slice(0, 8), { rightAlign: [1] }),
          tbl("Por equipamento", ["Equipamento", "NCs abertas"], byEquip, { rightAlign: [1], note: repeatedGroups.length ? `${repeatedNcs} NCs repetem pergunta + equipamento: possível duplicidade.` : undefined, internalOnly: true }),
        ],
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------ entrada
export const REPORT_KINDS: { key: ReportKind; label: string }[] = [
  { key: "consolidado", label: "Consolidado" },
  { key: "dto", label: "DTO" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "checklists", label: "Checklists" },
  { key: "ncs", label: "Não conformidades" },
  { key: "acidentes", label: "Acidentes" },
  { key: "guardian", label: "Guardian" },
  { key: "tma", label: "TMA" },
  { key: "producao", label: "Produção por turno" },
  { key: "produtividade", label: "Produtividade" },
  { key: "qualificacoes", label: "Qualificações" },
  { key: "presenca", label: "Presença e faltas" },
  { key: "disciplina", label: "Medidas disciplinares" },
  { key: "financeiro", label: "Financeiro (DRE)" },
];

const cache = new Map<string, { at: number; report: MonthlyReport }>();

export async function buildDetailedReport(user: CurrentUser, kind: Exclude<ReportKind, "consolidado">, month: string, version: ReportVersion): Promise<MonthlyReport> {
  const cacheKey = `${user.id}|${kind}|${month}|${version}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < 120000) return hit.report;
  const nowKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const ctx: DetailCtx = { user, month, prev: shiftMonth(month, -1), internal: version === "interno", nowKey };
  const builders = { dto: buildDto, equipamentos: buildEquipments, checklists: buildChecklists, ncs: buildNcs, acidentes: buildAccidentsReport, guardian: buildGuardianReport, tma: buildTmaReport, producao: buildProductionReport, produtividade: buildProductivityReport, qualificacoes: buildQualificationsReport, presenca: buildAttendanceReport, disciplina: buildDisciplineReport, financeiro: buildFinanceReport } as const;
  const out = await builders[kind](ctx);
  const internal = version === "interno";
  const report: MonthlyReport = {
    kind,
    title: out.title,
    month,
    monthLabel: monthLabelOf(month),
    version,
    generatedAt: new Date().toISOString(),
    generatedBy: user.name,
    executive: out.executive,
    findings: sortFindings(out.findings.filter((f) => internal || !f.internalOnly)),
    sections: out.sections.map((s) => ({ ...s, tables: s.tables.filter((t) => internal || !t.internalOnly) })),
    unavailable: [],
  };
  cache.set(cacheKey, { at: Date.now(), report });
  return report;
}

void num;
