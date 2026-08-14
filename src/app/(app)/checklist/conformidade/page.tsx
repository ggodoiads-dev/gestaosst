import Link from "next/link";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { requireUser } from "@/server/auth/current-user";
import {
  getChecklistComplianceDashboard,
  getChecklistComplianceRange,
  listChecklistEligibleCollaborators,
} from "@/server/services/checklist-compliance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/domain/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChecklistComplianceCollaboratorPicker } from "./checklist-compliance-collaborator-picker";

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
  return `/checklist/conformidade?${sp.toString()}`;
}

export default async function ChecklistConformidadePage({
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
  const [collaborators, dashboard] = await Promise.all([
    listChecklistEligibleCollaborators(user),
    getChecklistComplianceDashboard(user),
  ]);

  let rangeReport: Awaited<ReturnType<typeof getChecklistComplianceRange>> | null = null;
  if (collaboratorId) {
    rangeReport = await getChecklistComplianceRange(user, { collaboratorId, from: rangeFrom, to: rangeTo });
  }

  return (
    <>
      <PageHeader
        title="Conformidade de Checklist"
        description="Quem, marcado como 'Faz checklist', cumpriu o checklist dos equipamentos da própria área em cada turno escalado — e quem ficou pendente."
      />
      <PageBody className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Hoje — {formatDate(dashboard.date)}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Escalados hoje" value={dashboard.today.collaboratorsScheduled} />
            <StatCard label="Cumpriram tudo" value={dashboard.today.collaboratorsComplete} tone="success" />
            <StatCard
              label="Com pendência"
              value={dashboard.today.collaboratorsIncomplete.length}
              tone={dashboard.today.collaboratorsIncomplete.length > 0 ? "danger" : "success"}
            />
          </div>
          {dashboard.today.collaboratorsIncomplete.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quem ainda não terminou o checklist hoje</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {dashboard.today.collaboratorsIncomplete.map((c) => (
                  <Badge key={c.id} tone="danger">
                    {c.name} — {c.pendingCount} pendente{c.pendingCount > 1 ? "s" : ""}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Mês — {MONTH_LABELS[now.getMonth()]} de {now.getFullYear()}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Colaboradores escalados" value={dashboard.month.collaboratorsScheduled} />
            <StatCard label="Em dia o mês todo" value={dashboard.month.collaboratorsComplete} tone="success" />
            <StatCard
              label="Com pendência no mês"
              value={dashboard.month.collaboratorsIncomplete.length}
              tone={dashboard.month.collaboratorsIncomplete.length > 0 ? "warning" : "success"}
            />
          </div>
          {dashboard.month.collaboratorsIncomplete.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Quem ficou com pendência em algum turno do mês</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col divide-y divide-border">
                  {dashboard.month.collaboratorsIncomplete
                    .sort((a, b) => b.pendingCount - a.pendingCount)
                    .map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span>{c.name}</span>
                        <span className="font-semibold tabular-nums text-danger">
                          {c.pendingCount} pendente{c.pendingCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">Relatório por colaborador</h2>
          <p className="text-sm text-foreground-subtle">
            Escolha um colaborador pra ver o checklist da área — o que ele fez e o que ficou pendente — por dia, semana ou mês.
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
      </PageBody>
    </>
  );
}
