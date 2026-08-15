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
  getChecklistComplianceRange,
} from "@/server/services/checklist-compliance.service";
import {
  getProductivityDashboard,
  getProductivityRange,
  getProductivityGoalsProgress,
  getAllProductivityGoalsProgress,
} from "@/server/services/productivity.service";
import { listActivitiesForUser } from "@/server/services/activity.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { getChecklistAdherence } from "@/server/services/time-clock.service";
import { listActiveCollaboratorsForSupervision } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DonutStat } from "@/components/domain/charts/donut-stat";
import { HorizontalBarChart } from "@/components/domain/charts/horizontal-bar-chart";
import { cn } from "@/lib/utils";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ChecklistComplianceCollaboratorPicker } from "./checklist-compliance-collaborator-picker";
import { ChecklistAdherenceCard } from "./checklist-adherence-card";
import { ProductivityGoalDialog, DeleteProductivityGoalButton } from "./productivity-goal-dialog";
import { ProductivityCalendarClient } from "./productivity-calendar-client";

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

function toInputValue(date: Date): string {
  return localDateKey(date);
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

function progressBar(percent: number) {
  return (
    <div className="h-2 flex-1 rounded-full bg-neutral-soft overflow-hidden">
      <div
        className={cn("h-full rounded-full", percent >= 100 ? "bg-success" : percent >= 60 ? "bg-accent" : "bg-warning")}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ collaboratorId?: string; period?: string; ref?: string }>;
}) {
  const { collaboratorId, period: periodParam, ref: refParam } = await searchParams;
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
  const canSeeProductivity = hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE);
  const canSeeCollaboratorReport = canSeeChecklistCompliance || canSeeProductivity;

  const adherenceTo = new Date();
  const adherenceFrom = new Date();
  adherenceFrom.setDate(adherenceFrom.getDate() - 13);

  const [summary, desempenho, topEquipamentos, topFalhas, riskRanking, checklistAdherence] = await Promise.all([
    getGestaoSummary(user),
    getDesempenhoPorArea(user),
    getTopProblemEquipments(user),
    getTopFaultCategories(user),
    getEquipmentRiskRanking(user),
    getChecklistAdherence(user, { from: adherenceFrom, to: adherenceTo }),
  ]);

  let collaborators: Awaited<ReturnType<typeof listActiveCollaboratorsForSupervision>> = [];
  let checklistDashboard: Awaited<ReturnType<typeof getChecklistComplianceDashboard>> | null = null;
  let checklistRangeReport: Awaited<ReturnType<typeof getChecklistComplianceRange>> | null = null;
  let productivityDashboard: Awaited<ReturnType<typeof getProductivityDashboard>> | null = null;
  let productivityRangeReport: Awaited<ReturnType<typeof getProductivityRange>> | null = null;
  let activities: Awaited<ReturnType<typeof listActivitiesForUser>> = [];
  let currentMonthGoals: Awaited<ReturnType<typeof getAllProductivityGoalsProgress>> = [];
  let collaboratorGoals: Awaited<ReturnType<typeof getProductivityGoalsProgress>> = [];

  if (canSeeCollaboratorReport) {
    collaborators = await listActiveCollaboratorsForSupervision(user);
  }
  if (canSeeChecklistCompliance) {
    checklistDashboard = await getChecklistComplianceDashboard(user);
    if (collaboratorId) {
      checklistRangeReport = await getChecklistComplianceRange(user, { collaboratorId, from: rangeFrom, to: rangeTo });
    }
  }
  if (canSeeProductivity) {
    [productivityDashboard, activities, currentMonthGoals] = await Promise.all([
      getProductivityDashboard(user),
      listActivitiesForUser(user),
      getAllProductivityGoalsProgress(user, { month: now.getMonth() + 1, year: now.getFullYear() }),
    ]);
    if (collaboratorId) {
      [productivityRangeReport, collaboratorGoals] = await Promise.all([
        getProductivityRange(user, { collaboratorId, from: rangeFrom, to: rangeTo }),
        getProductivityGoalsProgress(user, { collaboratorId, month: refDate.getMonth() + 1, year: refDate.getFullYear() }),
      ]);
    }
  }

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
          <StatCard
            label="% cumprimento hoje"
            value={`${summary.percentualCumprimento}%`}
            tone={summary.percentualCumprimento >= 90 ? "success" : summary.percentualCumprimento >= 70 ? "warning" : "danger"}
            href="/checklist/realizar"
          />
          <StatCard label="NCs abertas" value={summary.ncAbertas} tone="warning" href="/nao-conformidades" />
          <StatCard label="NCs críticas" value={summary.ncCriticas} tone="danger" href="/nao-conformidades?severity=CRITICA" />
          <StatCard label="Ações vencidas" value={summary.acoesVencidas} tone="danger" href="/planos-de-acao?overdue=true" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checklist de equipamentos hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutStat
              centerLabel="cumprido"
              centerValue={`${summary.percentualCumprimento}%`}
              segments={[
                { label: "Realizados", value: summary.realizados, color: "var(--success)" },
                { label: "Atrasados", value: summary.atrasados, color: "var(--danger)" },
                { label: "Pendentes", value: Math.max(summary.pendentes - summary.atrasados, 0), color: "var(--warning)" },
              ]}
            />
          </CardContent>
        </Card>

        {canSeeCollaboratorReport && (
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Relatório por colaborador</h2>
            <p className="text-sm text-foreground-subtle">
              Selecione um colaborador cadastrado em RH pra ver o checklist e a produtividade dele lado a lado.
            </p>

            <Tabs defaultValue={canSeeChecklistCompliance ? "checklist" : "produtividade"}>
              <TabsList>
                {canSeeChecklistCompliance && <TabsTrigger value="checklist">Checklist</TabsTrigger>}
                {canSeeProductivity && <TabsTrigger value="produtividade">Produtividade</TabsTrigger>}
              </TabsList>

              {canSeeChecklistCompliance && checklistDashboard && (
                <TabsContent value="checklist" className="flex flex-col gap-5">
                  <p className="text-sm text-foreground-subtle">
                    Quem, marcado como &quot;Faz checklist&quot;, cumpriu o checklist dos equipamentos da própria área em
                    cada turno escalado — e quem ficou pendente.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Card>
                      <CardHeader>
                        <CardTitle>Hoje — {formatDate(checklistDashboard.date)}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <DonutStat
                          centerLabel="em dia"
                          centerValue={
                            checklistDashboard.today.collaboratorsScheduled === 0
                              ? "100%"
                              : `${Math.round((checklistDashboard.today.collaboratorsComplete / checklistDashboard.today.collaboratorsScheduled) * 100)}%`
                          }
                          segments={[
                            { label: "Cumpriram tudo", value: checklistDashboard.today.collaboratorsComplete, color: "var(--success)" },
                            { label: "Com pendência", value: checklistDashboard.today.collaboratorsIncomplete.length, color: "var(--danger)" },
                          ]}
                        />
                        {checklistDashboard.today.collaboratorsIncomplete.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {checklistDashboard.today.collaboratorsIncomplete.map((c) => (
                              <Badge key={c.id} tone="danger">
                                {c.name} — {c.pendingCount} pendente{c.pendingCount > 1 ? "s" : ""}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Mês — {MONTH_LABELS[now.getMonth()]} de {now.getFullYear()}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <DonutStat
                          centerLabel="em dia"
                          centerValue={
                            checklistDashboard.month.collaboratorsScheduled === 0
                              ? "100%"
                              : `${Math.round((checklistDashboard.month.collaboratorsComplete / checklistDashboard.month.collaboratorsScheduled) * 100)}%`
                          }
                          segments={[
                            { label: "Em dia o mês todo", value: checklistDashboard.month.collaboratorsComplete, color: "var(--success)" },
                            { label: "Com pendência", value: checklistDashboard.month.collaboratorsIncomplete.length, color: "var(--warning)" },
                          ]}
                        />
                        {checklistDashboard.month.collaboratorsIncomplete.length > 0 && (
                          <div className="flex flex-col divide-y divide-border">
                            {checklistDashboard.month.collaboratorsIncomplete
                              .sort((a, b) => b.pendingCount - a.pendingCount)
                              .map((c) => (
                                <div key={c.id} className="flex items-center justify-between px-1 py-2 text-sm">
                                  <span>{c.name}</span>
                                  <span className="font-semibold tabular-nums text-danger">
                                    {c.pendingCount} pendente{c.pendingCount > 1 ? "s" : ""}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

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
                        {checklistRangeReport.collaborator.name}
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
                                <span className="font-medium text-foreground">
                                  {WEEKDAY_LABELS[d.date.getDay()]} — {formatDate(d.date)}
                                </span>
                                <Badge tone={!isWork ? "neutral" : !hasRequired ? "neutral" : d.future ? "info" : incomplete ? "danger" : "success"}>
                                  {!isWork ? "Folga" : !hasRequired ? "Sem checklist na área" : d.future ? "Agendado" : complete ? "Completo" : "Pendente"}
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
                </TabsContent>
              )}

              {canSeeProductivity && productivityDashboard && (
                <TabsContent value="produtividade" className="flex flex-col gap-6">
                  <p className="text-sm text-foreground-subtle">
                    Quem tinha turno de trabalho e lançou (ou não) a própria produção, o total por atividade e as
                    metas do mês.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Card>
                      <CardHeader>
                        <CardTitle>Hoje — {formatDate(productivityDashboard.date)}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <DonutStat
                          centerLabel="lançaram"
                          centerValue={
                            productivityDashboard.today.collaboratorsScheduled === 0
                              ? "100%"
                              : `${Math.round((productivityDashboard.today.collaboratorsLogged / productivityDashboard.today.collaboratorsScheduled) * 100)}%`
                          }
                          segments={[
                            { label: "Lançaram", value: productivityDashboard.today.collaboratorsLogged, color: "var(--success)" },
                            {
                              label: "Sem lançamento",
                              value: Math.max(
                                productivityDashboard.today.collaboratorsScheduled - productivityDashboard.today.collaboratorsLogged,
                                0,
                              ),
                              color: "var(--danger)",
                            },
                          ]}
                        />
                        {productivityDashboard.today.missingCollaborators.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {productivityDashboard.today.missingCollaborators.map((c) => (
                              <Badge key={c.id} tone="danger">{c.name}</Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Mês — {MONTH_LABELS[now.getMonth()]} de {now.getFullYear()}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <DonutStat
                          centerLabel="lançaram"
                          centerValue={
                            productivityDashboard.month.collaboratorsScheduled === 0
                              ? "100%"
                              : `${Math.round((productivityDashboard.month.collaboratorsLogged / productivityDashboard.month.collaboratorsScheduled) * 100)}%`
                          }
                          segments={[
                            { label: "Lançaram no mês", value: productivityDashboard.month.collaboratorsLogged, color: "var(--success)" },
                            {
                              label: "Sem lançamento",
                              value: Math.max(
                                productivityDashboard.month.collaboratorsScheduled - productivityDashboard.month.collaboratorsLogged,
                                0,
                              ),
                              color: "var(--warning)",
                            },
                          ]}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Produção por atividade (mês)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Atividade</TableHead>
                            <TableHead>Lançamentos</TableHead>
                            <TableHead>Quantidade total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productivityDashboard.month.byActivity.length === 0 && <TableEmpty colSpan={3} />}
                          {productivityDashboard.month.byActivity.map((a) => (
                            <TableRow key={a.activityId}>
                              <TableCell>{a.activityName}</TableCell>
                              <TableCell>{a.count}</TableCell>
                              <TableCell>{a.unit ? `${a.totalQuantity} ${a.unit}` : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Metas de {MONTH_LABELS[now.getMonth()]}</h3>
                    <ProductivityGoalDialog
                      collaborators={collaborators}
                      activities={activities}
                      month={now.getMonth() + 1}
                      year={now.getFullYear()}
                    />
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Colaborador</TableHead>
                            <TableHead>Atividade</TableHead>
                            <TableHead>Progresso</TableHead>
                            <TableHead className="w-16" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentMonthGoals.length === 0 && <TableEmpty colSpan={4} message="Nenhuma meta definida ainda." />}
                          {currentMonthGoals.map(({ goal, achieved, percent }) => (
                            <TableRow key={goal.id}>
                              <TableCell>{goal.collaborator.name}</TableCell>
                              <TableCell>{goal.activity.name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="max-w-40">{progressBar(percent)}</div>
                                  <span className="whitespace-nowrap text-xs tabular-nums text-foreground-subtle">
                                    {achieved}/{goal.targetQuantity}{goal.activity.unit ? ` ${goal.activity.unit}` : ""} ({percent}%)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <ProductivityGoalDialog
                                    collaborators={collaborators}
                                    activities={activities}
                                    month={now.getMonth() + 1}
                                    year={now.getFullYear()}
                                    goal={goal}
                                  />
                                  <DeleteProductivityGoalButton id={goal.id} />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="flex flex-col gap-3 border-t border-border pt-6">
                    <h3 className="text-sm font-semibold text-foreground">Relatório por colaborador</h3>
                    <p className="text-sm text-foreground-subtle">
                      Escolha um colaborador pra ver o que ele fez — e o que não fez — por dia, semana ou mês, e
                      lançar produção.
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
                          Selecione um colaborador acima pra ver o relatório e lançar produtividade.
                        </CardContent>
                      </Card>
                    )}

                    {productivityRangeReport && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm text-foreground-subtle">
                            {productivityRangeReport.collaborator.name}
                            {productivityRangeReport.collaborator.turno
                              ? ` · Turno ${productivityRangeReport.collaborator.turno.name}`
                              : " · Sem turno definido"}
                          </p>
                          <ProductivityGoalDialog
                            collaborators={collaborators}
                            activities={activities}
                            month={refDate.getMonth() + 1}
                            year={refDate.getFullYear()}
                            defaultCollaboratorId={collaboratorId}
                          />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <StatCard label="Dias trabalhados" value={productivityRangeReport.summary.workDays} />
                          <StatCard label="Com lançamento" value={productivityRangeReport.summary.daysWithEntries} tone="success" />
                          <StatCard
                            label="Sem lançamento"
                            value={productivityRangeReport.summary.daysMissing}
                            tone={productivityRangeReport.summary.daysMissing > 0 ? "danger" : "success"}
                          />
                          <StatCard label="Total de lançamentos" value={productivityRangeReport.summary.totalEntries} tone="accent" />
                        </div>

                        {collaboratorGoals.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Metas de {MONTH_LABELS[refDate.getMonth()]} de {refDate.getFullYear()}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                              {collaboratorGoals.map(({ goal, achieved, percent }) => (
                                <div key={goal.id} className="flex items-center gap-3">
                                  <span className="w-32 shrink-0 truncate text-sm">{goal.activity.name}</span>
                                  {progressBar(percent)}
                                  <span className="w-32 shrink-0 text-right text-xs tabular-nums text-foreground-subtle">
                                    {achieved}/{goal.targetQuantity}{goal.activity.unit ? ` ${goal.activity.unit}` : ""} ({percent}%)
                                  </span>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}

                        <ProductivityCalendarClient
                          collaboratorId={collaboratorId!}
                          collaboratorName={productivityRangeReport.collaborator.name}
                          activities={activities}
                          layout={period === "mes" ? "grid" : "list"}
                          days={productivityRangeReport.days.map((d) => ({
                            date: localDateKey(d.date),
                            day: d.date.getDate(),
                            weekday: WEEKDAY_LABELS[d.date.getDay()],
                            status: d.status,
                            entries: d.entries,
                          }))}
                        />
                      </>
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </section>
        )}

        <ChecklistAdherenceCard
          initialFrom={toInputValue(adherenceFrom)}
          initialTo={toInputValue(adherenceTo)}
          initialReport={checklistAdherence}
        />

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
