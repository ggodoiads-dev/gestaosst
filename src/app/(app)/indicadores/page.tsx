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
  listChecklistEligibleCollaborators,
} from "@/server/services/checklist-compliance.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { getChecklistAdherence } from "@/server/services/time-clock.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutStat } from "@/components/domain/charts/donut-stat";
import { HorizontalBarChart } from "@/components/domain/charts/horizontal-bar-chart";
import { cn } from "@/lib/utils";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ChecklistComplianceCollaboratorPicker } from "./checklist-compliance-collaborator-picker";
import { ChecklistAdherenceCard } from "./checklist-adherence-card";

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

  let collaborators: Awaited<ReturnType<typeof listChecklistEligibleCollaborators>> = [];
  let dashboard: Awaited<ReturnType<typeof getChecklistComplianceDashboard>> | null = null;
  let rangeReport: Awaited<ReturnType<typeof getChecklistComplianceRange>> | null = null;

  if (canSeeChecklistCompliance) {
    [collaborators, dashboard] = await Promise.all([
      listChecklistEligibleCollaborators(user),
      getChecklistComplianceDashboard(user),
    ]);
    if (collaboratorId) {
      rangeReport = await getChecklistComplianceRange(user, { collaboratorId, from: rangeFrom, to: rangeTo });
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

        {canSeeChecklistCompliance && dashboard && (
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Conformidade de checklist por colaborador</h2>
            <p className="text-sm text-foreground-subtle">
              Quem, marcado como &quot;Faz checklist&quot;, cumpriu o checklist dos equipamentos da própria área em cada turno
              escalado — e quem ficou pendente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Hoje — {formatDate(dashboard.date)}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <DonutStat
                    centerLabel="em dia"
                    centerValue={
                      dashboard.today.collaboratorsScheduled === 0
                        ? "100%"
                        : `${Math.round((dashboard.today.collaboratorsComplete / dashboard.today.collaboratorsScheduled) * 100)}%`
                    }
                    segments={[
                      { label: "Cumpriram tudo", value: dashboard.today.collaboratorsComplete, color: "var(--success)" },
                      { label: "Com pendência", value: dashboard.today.collaboratorsIncomplete.length, color: "var(--danger)" },
                    ]}
                  />
                  {dashboard.today.collaboratorsIncomplete.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {dashboard.today.collaboratorsIncomplete.map((c) => (
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
                      dashboard.month.collaboratorsScheduled === 0
                        ? "100%"
                        : `${Math.round((dashboard.month.collaboratorsComplete / dashboard.month.collaboratorsScheduled) * 100)}%`
                    }
                    segments={[
                      { label: "Em dia o mês todo", value: dashboard.month.collaboratorsComplete, color: "var(--success)" },
                      { label: "Com pendência", value: dashboard.month.collaboratorsIncomplete.length, color: "var(--warning)" },
                    ]}
                  />
                  {dashboard.month.collaboratorsIncomplete.length > 0 && (
                    <div className="flex flex-col divide-y divide-border">
                      {dashboard.month.collaboratorsIncomplete
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

            {rangeReport && (
              <>
                <p className="text-sm text-foreground-subtle">
                  {rangeReport.collaborator.name}
                  {rangeReport.collaborator.area ? ` · Área ${rangeReport.collaborator.area.name}` : " · Sem área definida"}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <StatCard label="Turnos trabalhados" value={rangeReport.summary.workDays} />
                  <StatCard label="Cumpriu tudo" value={rangeReport.summary.completeDays} tone="success" />
                  <StatCard
                    label="Com pendência"
                    value={rangeReport.summary.incompleteDays}
                    tone={rangeReport.summary.incompleteDays > 0 ? "danger" : "success"}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {rangeReport.days.map((d) => {
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
