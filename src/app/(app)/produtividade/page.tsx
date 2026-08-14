import Link from "next/link";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { requireUser } from "@/server/auth/current-user";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import {
  getProductivityDashboard,
  getProductivityRange,
  getProductivityGoalsProgress,
  getAllProductivityGoalsProgress,
} from "@/server/services/productivity.service";
import { listActivitiesForUser } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/domain/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductivityCollaboratorPicker } from "./productivity-collaborator-picker";
import { ProductivityCalendarClient } from "./productivity-calendar-client";
import { ProductivityGoalDialog, DeleteProductivityGoalButton } from "./productivity-goal-dialog";

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
  return `/produtividade?${sp.toString()}`;
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

export default async function ProdutividadePage({
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
  const [collaborators, activities, dashboard, currentMonthGoals] = await Promise.all([
    listCollaboratorsForUser(user, { onlyActive: true }),
    listActivitiesForUser(user),
    getProductivityDashboard(user),
    getAllProductivityGoalsProgress(user, { month: now.getMonth() + 1, year: now.getFullYear() }),
  ]);

  let rangeReport: Awaited<ReturnType<typeof getProductivityRange>> | null = null;
  let collaboratorGoals: Awaited<ReturnType<typeof getProductivityGoalsProgress>> = [];
  if (collaboratorId) {
    [rangeReport, collaboratorGoals] = await Promise.all([
      getProductivityRange(user, { collaboratorId, from: rangeFrom, to: rangeTo }),
      getProductivityGoalsProgress(user, { collaboratorId, month: refDate.getMonth() + 1, year: refDate.getFullYear() }),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Produtividade"
        description="Visão geral da produção da equipe, relatório por colaborador (o que fez e o que não fez) e metas mensais."
      />
      <PageBody className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Hoje — {formatDate(dashboard.date)}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Escalados hoje" value={dashboard.today.collaboratorsScheduled} />
            <StatCard label="Lançaram hoje" value={dashboard.today.collaboratorsLogged} tone="success" />
            <StatCard
              label="Sem lançamento"
              value={dashboard.today.missingCollaborators.length}
              tone={dashboard.today.missingCollaborators.length > 0 ? "danger" : "success"}
            />
            <StatCard label="Lançamentos hoje" value={dashboard.today.totalEntries} tone="accent" />
          </div>
          {dashboard.today.missingCollaborators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quem ainda não lançou hoje</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {dashboard.today.missingCollaborators.map((c) => (
                  <Badge key={c.id} tone="danger">{c.name}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Mês — {MONTH_LABELS[now.getMonth()]} de {now.getFullYear()}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Colaboradores escalados" value={dashboard.month.collaboratorsScheduled} />
            <StatCard label="Já lançaram algo" value={dashboard.month.collaboratorsLogged} tone="success" />
            <StatCard
              label="Nunca lançaram"
              value={dashboard.month.missingCollaborators.length}
              tone={dashboard.month.missingCollaborators.length > 0 ? "warning" : "success"}
            />
            <StatCard label="Lançamentos no mês" value={dashboard.month.totalEntries} tone="accent" />
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
                  {dashboard.month.byActivity.length === 0 && <TableEmpty colSpan={3} />}
                  {dashboard.month.byActivity.map((a) => (
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
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Metas de {MONTH_LABELS[now.getMonth()]}</h2>
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
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">Relatório por colaborador</h2>
          <p className="text-sm text-foreground-subtle">
            Escolha um colaborador pra ver o que ele fez — e o que não fez — por dia, semana ou mês, e lançar produção.
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <ProductivityCollaboratorPicker collaborators={collaborators} selectedId={collaboratorId} />
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

          {rangeReport && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground-subtle">
                  {rangeReport.collaborator.name}
                  {rangeReport.collaborator.turno ? ` · Turno ${rangeReport.collaborator.turno.name}` : " · Sem turno definido"}
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
                <StatCard label="Dias trabalhados" value={rangeReport.summary.workDays} />
                <StatCard label="Com lançamento" value={rangeReport.summary.daysWithEntries} tone="success" />
                <StatCard
                  label="Sem lançamento"
                  value={rangeReport.summary.daysMissing}
                  tone={rangeReport.summary.daysMissing > 0 ? "danger" : "success"}
                />
                <StatCard label="Total de lançamentos" value={rangeReport.summary.totalEntries} tone="accent" />
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
                collaboratorName={rangeReport.collaborator.name}
                activities={activities}
                layout={period === "mes" ? "grid" : "list"}
                days={rangeReport.days.map((d) => ({
                  date: localDateKey(d.date),
                  day: d.date.getDate(),
                  weekday: WEEKDAY_LABELS[d.date.getDay()],
                  status: d.status,
                  entries: d.entries,
                }))}
              />
            </>
          )}
        </section>
      </PageBody>
    </>
  );
}
