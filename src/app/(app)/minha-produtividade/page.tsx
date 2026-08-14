import Link from "next/link";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { requireUser } from "@/server/auth/current-user";
import {
  getMyCollaboratorProfile,
  getProductivityRange,
  getProductivityGoalsProgress,
} from "@/server/services/productivity.service";
import { listActiveActivitiesForSelfLog } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/domain/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductivityCalendarClient } from "../produtividade/productivity-calendar-client";

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

function buildHref(params: { period: Period; ref: string }) {
  const sp = new URLSearchParams({ period: params.period, ref: params.ref });
  return `/minha-produtividade?${sp.toString()}`;
}

export default async function MinhaProdutividadePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const { period: periodParam, ref: refParam } = await searchParams;
  const period: Period = periodParam === "dia" || periodParam === "semana" ? periodParam : "mes";
  const refDate = refParam ? parseDateOnly(refParam) : new Date();

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
  const collaborator = await getMyCollaboratorProfile(user);

  if (!collaborator) {
    return (
      <>
        <PageHeader title="Minha Produtividade" description="Lance o que você produziu em cada dia trabalhado." />
        <PageBody>
          <Card>
            <CardContent className="py-10 text-center text-sm text-foreground-subtle">
              Seu usuário ainda não está vinculado a um colaborador. Peça pro seu gestor vincular seu acesso.
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const [activities, rangeReport, goals] = await Promise.all([
    listActiveActivitiesForSelfLog(user),
    getProductivityRange(user, { collaboratorId: collaborator.id, from: rangeFrom, to: rangeTo }),
    getProductivityGoalsProgress(user, { collaboratorId: collaborator.id, month: refDate.getMonth() + 1, year: refDate.getFullYear() }),
  ]);

  return (
    <>
      <PageHeader
        title="Minha Produtividade"
        description="Lance o que você produziu em cada dia trabalhado — por dia, semana ou mês."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border-strong">
              {(["dia", "semana", "mes"] as const).map((p) => (
                <Link
                  key={p}
                  href={buildHref({ period: p, ref: localDateKey(refDate) })}
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
              <Link href={buildHref({ period, ref: localDateKey(prevRef) })} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-40 text-center text-sm font-medium text-foreground">{rangeLabel}</span>
            <Button size="icon" variant="secondary" asChild>
              <Link href={buildHref({ period, ref: localDateKey(nextRef) })} aria-label="Próximo">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody className="flex flex-col gap-5">
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

        {goals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Minhas metas de {MONTH_LABELS[refDate.getMonth()]}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {goals.map(({ goal, achieved, percent }) => (
                <div key={goal.id} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm">{goal.activity.name}</span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-soft overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", percent >= 100 ? "bg-success" : percent >= 60 ? "bg-accent" : "bg-warning")}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-xs tabular-nums text-foreground-subtle">
                    {achieved}/{goal.targetQuantity}{goal.activity.unit ? ` ${goal.activity.unit}` : ""} ({percent}%)
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <ProductivityCalendarClient
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.name}
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
      </PageBody>
    </>
  );
}
