import Link from "next/link";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { requireUser, requirePermission, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  getGestaoSummary,
  getDesempenhoPorArea,
  getTopProblemEquipments,
  getTopFaultCategories,
} from "@/server/services/indicators.service";
import {
  getChecklistComplianceDashboard,
  compliancePercent,
  getChecklistComplianceRange,
  getChecklistComplianceExplorer,
  getChecklistCoverageGaps,
} from "@/server/services/checklist-compliance.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { listActiveCollaboratorsForSupervision } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutStat } from "@/components/domain/charts/donut-stat";
import { HorizontalBarChart } from "@/components/domain/charts/horizontal-bar-chart";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import { formatDate, parseDateOnly, APP_TIMEZONE } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import { ChecklistComplianceCollaboratorPicker } from "./checklist-compliance-collaborator-picker";
import { TodayProgressPanel } from "./today-progress-panel";
import { PeriodToolbar } from "./period-toolbar";
import { PeriodPeoplePanel } from "./period-people-panel";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Period = "dia" | "semana" | "mes";

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildHref(params: { collaboratorId: string; period: Period; ref: string }) {
  const sp = new URLSearchParams({ collaboratorId: params.collaboratorId, period: params.period, ref: params.ref });
  return `/indicadores?${sp.toString()}`;
}

function riskTone(score: number): "success" | "warning" | "danger" {
  if (score > 60) return "danger";
  if (score > 30) return "warning";
  return "success";
}

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ collaboratorId?: string; period?: string; ref?: string; cp?: string; cr?: string }>;
}) {
  const { collaboratorId, period: periodParam, ref: refParam, cp, cr } = await searchParams;
  const now = new Date();
  const period: Period = periodParam === "dia" || periodParam === "semana" ? periodParam : "mes";
  const refDate = refParam ? parseDateOnly(refParam) : now;

  let rangeFrom: Date;
  let rangeTo: Date;
  let prevRef: Date;
  let nextRef: Date;
  let rangeLabel: string;

  if (period === "dia") {
    rangeFrom = refDate;
    rangeTo = refDate;
    prevRef = addDays(refDate, -1);
    nextRef = addDays(refDate, 1);
    rangeLabel = `${WEEKDAY_LABELS[refDate.getDay()]}, ${formatDate(refDate)}`;
  } else if (period === "semana") {
    rangeFrom = startOfWeek(refDate, { weekStartsOn: 0 });
    rangeTo = endOfWeek(refDate, { weekStartsOn: 0 });
    prevRef = addWeeks(refDate, -1);
    nextRef = addWeeks(refDate, 1);
    rangeLabel = `${formatDate(rangeFrom)} a ${formatDate(rangeTo)}`;
  } else {
    rangeFrom = startOfMonth(refDate);
    rangeTo = endOfMonth(refDate);
    prevRef = addMonths(refDate, -1);
    nextRef = addMonths(refDate, 1);
    rangeLabel = `${MONTH_LABELS[refDate.getMonth()]} de ${refDate.getFullYear()}`;
  }

  const user = await requireUser();
  requirePermission(user, PERMISSIONS.INDICATORS_VIEW_AREA);
  const canSeeChecklistCompliance = hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const canSeeCollaboratorReport = canSeeChecklistCompliance;

  const [summary, desempenho, topEquipamentos, topFalhas, riskRanking] = await Promise.all([
    getGestaoSummary(user),
    getDesempenhoPorArea(user),
    getTopProblemEquipments(user),
    getTopFaultCategories(user),
    getEquipmentRiskRanking(user),
  ]);

  let collaborators: Awaited<ReturnType<typeof listActiveCollaboratorsForSupervision>> = [];
  let checklistDashboard: Awaited<ReturnType<typeof getChecklistComplianceDashboard>> | null = null;
  let explorer: Awaited<ReturnType<typeof getChecklistComplianceExplorer>> | null = null;
  let coverageGaps: Awaited<ReturnType<typeof getChecklistCoverageGaps>> | null = null;
  let checklistRangeReport: Awaited<ReturnType<typeof getChecklistComplianceRange>> | null = null;

  if (canSeeCollaboratorReport) {
    collaborators = await listActiveCollaboratorsForSupervision(user);
  }
  if (canSeeChecklistCompliance) {
    checklistDashboard = await getChecklistComplianceDashboard(user);
    coverageGaps = await getChecklistCoverageGaps(user).catch(() => null);
    const todayKeyBrt = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
    explorer = await getChecklistComplianceExplorer(user, {
      period: cp === "mes" || cp === "ano" ? cp : "dia",
      refKey: cr && /^\d{4}-\d{2}-\d{2}$/.test(cr) ? cr : todayKeyBrt,
    });
    if (collaboratorId) {
      checklistRangeReport = await getChecklistComplianceRange(user, { collaboratorId, from: rangeFrom, to: rangeTo });
    }
  }
  const complianceYesterdayPercent = checklistDashboard ? compliancePercent(checklistDashboard.today) : null;

  const desempenhoBars = desempenho.map((d) => ({
    name: d.areaName,
    value: d.totalEquipamentos > 0 ? Math.round((d.realizadosHoje / d.totalEquipamentos) * 100) : 0,
  }));
  const topEquipamentosBars = topEquipamentos.map(({ equipment, count }) => ({
    name: equipment.code,
    value: count,
    color: "var(--danger)",
  }));
  const topFalhasBars = topFalhas.map(({ category, count }) => ({ name: category.name, value: count, color: "var(--warning)" }));

  return (
    <>
      <PageHeader
        title="Indicadores"
        description="Todo indicador é clicável e leva aos registros que o originaram."
      />
      <PageBody className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {checklistDashboard ? (
            <StatCard
              label="Aderência de checklist (ontem)"
              value={complianceYesterdayPercent === null ? "—" : `${complianceYesterdayPercent}%`}
              tone={
                complianceYesterdayPercent === null
                  ? "neutral"
                  : complianceYesterdayPercent >= 90
                    ? "success"
                    : complianceYesterdayPercent >= 70
                      ? "warning"
                      : "danger"
              }
              href="/indicadores#checklist-por-colaborador"
            />
          ) : (
            <StatCard
              label="Checklists feitos hoje (equipamentos)"
              value={summary.percentualCumprimento === null ? "—" : `${summary.percentualCumprimento}%`}
              tone="neutral"
              href="/checklist/realizar"
            />
          )}
          <StatCard label="NCs abertas" value={summary.ncAbertas} tone="warning" href="/nao-conformidades" />
          <StatCard label="NCs críticas" value={summary.ncCriticas} tone="danger" href="/nao-conformidades?severity=CRITICA" />
          <StatCard label="Ações vencidas" value={summary.acoesVencidas} tone="danger" href="/planos-de-acao?overdue=true" />
        </div>

        {checklistDashboard ? (
          <Card id="checklist-por-colaborador">
            <CardHeader>
              <CardTitle>Aderência de checklist por colaborador</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                { title: `Ontem — ${formatDate(checklistDashboard.date)}`, stats: checklistDashboard.today },
                { title: `Mês — ${MONTH_LABELS[now.getMonth()]} de ${now.getFullYear()} (até ontem)`, stats: checklistDashboard.month },
              ].map(({ title, stats }) => {
                const pct = compliancePercent(stats);
                const noAccessCount = stats.collaboratorsIncomplete.filter((c) => c.noAccess).length;
                return (
                  <div key={title} className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <DonutStat
                      centerLabel="aderência"
                      centerValue={pct === null ? "—" : `${pct}%`}
                      segments={[
                        { label: "Turnos cumpridos", value: stats.shiftsComplete, color: "var(--success)" },
                        { label: "Turnos pendentes", value: stats.shiftsRequired - stats.shiftsComplete, color: "var(--danger)" },
                      ]}
                    />
                    <p className="text-xs text-foreground-subtle">
                      {stats.collaboratorsComplete} de {stats.collaboratorsScheduled} colaborador(es) em dia
                      {noAccessCount > 0 && ` · ${noAccessCount} ainda sem acesso ao sistema`}
                    </p>
                  </div>
                );
              })}
              {coverageGaps && (coverageGaps.unconfigured.length > 0 || coverageGaps.uncovered.length > 0) && (
                <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 sm:col-span-2">
                  <p className="text-sm font-semibold text-warning">Quem não está sendo cobrado por checklist</p>
                  {coverageGaps.uncovered.length > 0 && (
                    <div className="text-sm text-foreground">
                      <p className="mb-1 text-xs text-foreground-subtle">
                        Gente ativa sem nenhuma cobrança de checklist (ADM/liderança fora). Se algum desses precisa fazer, marque &quot;Precisa de
                        checklist&quot; no colaborador ou configure o checklist obrigatório na função, e crie o modelo de checklist se ainda não existir:
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {coverageGaps.uncovered.map((u) => (
                          <li key={u.functionName} className="rounded-md bg-surface px-2.5 py-1 text-xs">
                            <strong className="tabular-nums">{u.count}</strong> {u.functionName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {coverageGaps.unconfigured.length > 0 && (
                    <div className="text-sm text-foreground">
                      <p className="mb-1 text-xs text-foreground-subtle">
                        São cobrados, mas a cobrança não consegue funcionar (e por isso não entram na %):
                      </p>
                      <ul className="flex flex-col gap-0.5 text-xs">
                        {coverageGaps.unconfigured.map((u) => (
                          <li key={u.id}>
                            <strong>{formatPersonName(u.name)}</strong>
                            {u.functionName && <span className="text-foreground-subtle"> ({u.functionName})</span>} — {u.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {explorer && (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {explorer.period === "dia"
                        ? explorer.isOpenDay
                          ? "Hoje — andamento"
                          : `Dia ${formatDate(parseDateOnly(explorer.refKey))}`
                        : explorer.period === "mes"
                          ? `${MONTH_LABELS[parseDateOnly(explorer.refKey).getMonth()]} de ${parseDateOnly(explorer.refKey).getFullYear()}`
                          : `Ano ${parseDateOnly(explorer.refKey).getFullYear()}`}
                      {explorer.isOpenDay && (
                        <span className="font-normal text-foreground-subtle"> (ainda não entra na aderência, que fecha em D-1)</span>
                      )}
                      {explorer.cappedAtYesterday && (
                        <span className="font-normal text-foreground-subtle"> (até ontem)</span>
                      )}
                    </p>
                    <PeriodToolbar
                      period={explorer.period}
                      refKey={explorer.refKey}
                      todayKey={formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd")}
                    />
                  </div>

                  {!explorer.isOpenDay && explorer.stats.shiftsRequired > 0 && (
                    <p className="text-sm text-foreground-subtle">
                      Aderência no período:{" "}
                      <span className="font-semibold text-foreground">{compliancePercent(explorer.stats)}%</span> ·{" "}
                      {explorer.stats.shiftsComplete} de {explorer.stats.shiftsRequired} turnos cumpridos
                    </p>
                  )}

                  {explorer.period === "dia" && explorer.dayProgress ? (
                    explorer.dayProgress.concluded.length + explorer.dayProgress.remaining.length === 0 ? (
                      <p className="text-xs text-foreground-subtle">Ninguém cobrado por checklist estava escalado nesse dia.</p>
                    ) : (
                      <TodayProgressPanel
                        key={explorer.refKey}
                        concluded={explorer.dayProgress.concluded}
                        remaining={explorer.dayProgress.remaining}
                        dayKey={explorer.dayProgress.dayKey}
                        canJustify={explorer.canJustify}
                        when={explorer.isOpenDay ? "hoje" : "nesse dia"}
                        off={explorer.dayProgress.off}
                      />
                    )
                  ) : explorer.stats.people.length === 0 ? (
                    <p className="text-xs text-foreground-subtle">Sem turnos cobrados nesse período.</p>
                  ) : (
                    <PeriodPeoplePanel key={`${explorer.period}-${explorer.refKey}`} people={explorer.stats.people} refKey={explorer.refKey} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Checklists de hoje (equipamento + área)</CardTitle>
            </CardHeader>
            <CardContent>
              <DonutStat
                centerLabel="cumprido"
                centerValue={summary.percentualCumprimento === null ? "—" : `${summary.percentualCumprimento}%`}
                segments={[
                  { label: "Realizados", value: summary.realizados, color: "var(--success)" },
                  { label: "Atrasados", value: summary.atrasados, color: "var(--danger)" },
                  { label: "Pendentes", value: Math.max(summary.pendentes - summary.atrasados, 0), color: "var(--warning)" },
                ]}
              />
            </CardContent>
          </Card>
        )}

        {canSeeCollaboratorReport && (
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Relatório de checklist por colaborador</h2>

              {canSeeChecklistCompliance && checklistDashboard && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-foreground-subtle">
                    Escolha um colaborador para ver, dia a dia, o que ele fez e o que faltou. O resumo de quem concluiu e de
                    quem falta (por dia, mês ou ano) fica no card &quot;Aderência de checklist por colaborador&quot;, mais acima.
                  </p>

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <ChecklistComplianceCollaboratorPicker collaborators={collaborators} selectedId={collaboratorId} />
                    {collaboratorId && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex overflow-hidden rounded-md border border-border-strong">
                          {(["dia", "semana", "mes"] as const).map((p) => (
                            <Link
                              key={p}
                              href={buildHref({ collaboratorId, period: p, ref: localDateKey(refDate) })}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium",
                                period === p ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
                              )}
                            >
                              {p === "mes" ? "Mês" : p === "semana" ? "Semana" : "Dia"}
                            </Link>
                          ))}
                        </div>
                        <Button size="icon" variant="secondary" asChild>
                          <Link href={buildHref({ collaboratorId, period, ref: localDateKey(prevRef) })} aria-label="Anterior">
                            <ChevronLeft className="size-4" />
                          </Link>
                        </Button>
                        <span className="min-w-40 text-center text-sm font-medium text-foreground">{rangeLabel}</span>
                        <Button size="icon" variant="secondary" asChild>
                          <Link href={buildHref({ collaboratorId, period, ref: localDateKey(nextRef) })} aria-label="Próximo">
                            <ChevronRight className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  {!collaboratorId && (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-foreground-subtle">
                        Selecione um colaborador acima pra ver o relatório de conformidade.
                      </CardContent>
                    </Card>
                  )}

                  {checklistRangeReport && (
                    <>
                      <p className="text-sm text-foreground-subtle">
                        {formatPersonName(checklistRangeReport.collaborator.name)}
                        {checklistRangeReport.collaborator.area
                          ? ` · Área ${checklistRangeReport.collaborator.area.name}`
                          : " · Sem área definida"}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <StatCard label="Turnos trabalhados" value={checklistRangeReport.summary.workDays} />
                        <StatCard label="Cumpriu tudo" value={checklistRangeReport.summary.completeDays} tone="success" />
                        <StatCard
                          label="Com pendência"
                          value={checklistRangeReport.summary.incompleteDays}
                          tone={checklistRangeReport.summary.incompleteDays > 0 ? "danger" : "success"}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        {checklistRangeReport.days.map((d) => {
                          const isWork = d.status === "TRABALHO";
                          const hasRequired = d.required.length > 0;
                          const complete = isWork && hasRequired && d.pending.length === 0;
                          const incomplete = isWork && hasRequired && d.pending.length > 0 && !d.future;
                          return (
                            <div
                              key={localDateKey(d.date)}
                              className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <Link
                                  href={`/indicadores/checklist/${checklistRangeReport.collaborator.id}?dia=${localDateKey(d.date)}`}
                                  className="font-medium text-foreground hover:underline"
                                >
                                  {WEEKDAY_LABELS[d.date.getDay()]} — {formatDate(d.date)}
                                </Link>
                                <Badge tone={!isWork ? "neutral" : !hasRequired ? "neutral" : d.future ? "info" : incomplete ? "danger" : "success"}>
                                  {!isWork ? "Folga" : !hasRequired ? "Sem checklist na área" : d.future ? "Em aberto" : complete ? "Completo" : "Pendente"}
                                </Badge>
                              </div>
                              {isWork && hasRequired && !d.future && (
                                <p className="text-xs text-foreground-subtle">
                                  {d.completed.length}/{d.required.length} feito
                                  {d.pending.length > 0 && (
                                    <> — faltou: {d.pending.map((e) => e.code).join(", ")}</>
                                  )}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
          </section>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Painel de Risco (IA)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {riskRanking.length === 0 && (
              <p className="px-4 py-6 text-sm text-foreground-subtle">Sem dados suficientes ainda.</p>
            )}
            {riskRanking.map((item) => (
              <Link
                key={item.equipmentId}
                href={`/equipamentos/${item.equipmentId}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {item.equipmentCode} — {item.equipmentName}{" "}
                    <span className="text-foreground-subtle">· {item.areaName}</span>
                  </p>
                  {item.latestAiFinding && (
                    <p className="truncate text-xs text-foreground-subtle">🤖 {item.latestAiFinding.summary}</p>
                  )}
                </div>
                <Badge tone={riskTone(item.score)}>{item.score}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho por área</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HorizontalBarChart data={desempenhoBars} color="var(--info)" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>Equipamentos com checklist</TableHead>
                  <TableHead>Realizados hoje</TableHead>
                  <TableHead>NCs abertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desempenho.length === 0 && <TableEmpty colSpan={4} />}
                {desempenho.map((d) => (
                  <TableRow key={d.areaId}>
                    <TableCell>{d.areaName}</TableCell>
                    <TableCell>{d.totalEquipamentos}</TableCell>
                    <TableCell>{d.realizadosHoje} / {d.totalEquipamentos}</TableCell>
                    <TableCell>{d.ncsAbertas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos com mais problemas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <HorizontalBarChart data={topEquipamentosBars} />
              <div className="flex flex-col divide-y divide-border">
                {topEquipamentos.map(({ equipment, count }) => (
                  <Link
                    key={equipment.id}
                    href={`/equipamentos/${equipment.id}`}
                    className="flex items-center justify-between px-1 py-2 text-sm hover:bg-surface-muted"
                  >
                    <span>{equipment.code} — {equipment.name}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de falha mais frequentes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <HorizontalBarChart data={topFalhasBars} />
              <div className="flex flex-col divide-y divide-border">
                {topFalhas.map(({ category, count }) => (
                  <div key={category.id} className="flex items-center justify-between px-1 py-2 text-sm">
                    <span>{category.name}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
