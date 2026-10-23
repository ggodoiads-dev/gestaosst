import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { displayUnit, isWarehouseHelper } from "@/domain/production/helpers";
import { getProductivityGoalsProgress, getProductivityRange } from "@/server/services/productivity.service";
import { listActiveActivitiesForProductivityLog } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { formatDate, parseDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ProductivityCalendarClient } from "../../indicadores/productivity-calendar-client";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Period = "dia" | "semana" | "mes";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function AjudanteProdutividadePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; ref?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam, ref: refParam } = await searchParams;
  const period: Period = periodParam === "dia" || periodParam === "semana" ? periodParam : "mes";
  const refDate = refParam && /^\d{4}-\d{2}-\d{2}$/.test(refParam) ? parseDateOnly(refParam) : new Date();
  const user = await requireUser();

  let from: Date;
  let to: Date;
  let prev: Date;
  let next: Date;
  let label: string;
  if (period === "dia") {
    from = to = refDate;
    prev = addDays(refDate, -1);
    next = addDays(refDate, 1);
    label = `${WEEKDAYS[refDate.getDay()]}, ${formatDate(refDate)}`;
  } else if (period === "semana") {
    from = startOfWeek(refDate, { weekStartsOn: 0 });
    to = endOfWeek(refDate, { weekStartsOn: 0 });
    prev = addWeeks(refDate, -1);
    next = addWeeks(refDate, 1);
    label = `${formatDate(from)} a ${formatDate(to)}`;
  } else {
    from = startOfMonth(refDate);
    to = endOfMonth(refDate);
    prev = addMonths(refDate, -1);
    next = addMonths(refDate, 1);
    label = `${MONTHS[refDate.getMonth()]} de ${refDate.getFullYear()}`;
  }

  const [report, goals, activities] = await Promise.all([
    getProductivityRange(user, { collaboratorId: id, from, to }).catch(() => null),
    getProductivityGoalsProgress(user, { collaboratorId: id, month: refDate.getMonth() + 1, year: refDate.getFullYear() }).catch(() => []),
    listActiveActivitiesForProductivityLog(user).catch(() => []),
  ]);
  if (!report || !isWarehouseHelper(report.collaborator)) notFound();

  const canEdit = hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE) || hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM) || user.canRollCall;
  const href = (p: { period: Period; ref: Date }) => `/produtividade/${id}?period=${p.period}&ref=${dayKey(p.ref)}`;

  const totals = new Map<string, { name: string; unit: string | null; quantity: number; count: number }>();
  for (const d of report.days) {
    for (const e of d.entries) {
      const acc = totals.get(e.activityId) ?? { name: e.activity.name, unit: e.activity.unit, quantity: 0, count: 0 };
      acc.quantity += e.quantity ?? 0;
      acc.count += 1;
      totals.set(e.activityId, acc);
    }
  }
  const totalRows = [...totals.values()].sort((a, b) => b.quantity - a.quantity || b.count - a.count);
  const cover = report.summary.workDays === 0 ? null : Math.round((report.summary.daysWithEntries / report.summary.workDays) * 100);

  return (
    <>
      <PageHeader
        title={report.collaborator.name}
        description={`Ajudante de armazém${report.collaborator.turno ? ` · Turno ${report.collaborator.turno.name}` : ""}. Produtividade por dia, por atividade e metas.`}
        actions={
          <Link href={`/produtividade?periodo=${dayKey(refDate).slice(0, 7)}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted">
            <ArrowLeft className="size-4" /> Todos os ajudantes
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border-strong">
            {(["dia", "semana", "mes"] as const).map((p) => (
              <Link key={p} href={href({ period: p, ref: refDate })} className={cn("px-3 py-1.5 text-xs font-medium", period === p ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted")}>
                {p === "mes" ? "Mês" : p === "semana" ? "Semana" : "Dia"}
              </Link>
            ))}
          </div>
          <Link href={href({ period, ref: prev })} aria-label="Anterior" className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 text-center text-sm font-semibold text-foreground">{label}</span>
          <Link href={href({ period, ref: next })} aria-label="Próximo" className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted">
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Dias de trabalho" value={String(report.summary.workDays)} />
          <Tile label="Dias com lançamento" value={String(report.summary.daysWithEntries)} sub={cover === null ? undefined : `${cover}% dos dias de trabalho`} />
          <Tile label="Sem lançamento" value={String(report.summary.daysMissing)} sub={report.summary.daysMissing > 0 ? "dias de trabalho em branco" : "tudo lançado"} danger={report.summary.daysMissing > 0} />
          <Tile label="Lançamentos" value={String(report.summary.totalEntries)} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Produção no período</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <th className="px-3 py-1.5 text-left font-semibold">Atividade</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Lançamentos</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {totalRows.map((r) => (
                  <tr key={r.name} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-1.5 text-foreground">{r.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground-muted">{r.count}</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-foreground">{r.quantity.toLocaleString("pt-BR")}{displayUnit(r.unit) ? ` ${displayUnit(r.unit)}` : ""}</td>
                  </tr>
                ))}
                {totalRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-foreground-subtle">Nenhum lançamento neste período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Metas de {MONTHS[refDate.getMonth()].toLowerCase()}</h3>
            <div className="flex flex-col gap-3 p-3">
              {goals.map(({ goal, achieved, percent }) => (
                <div key={goal.id}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-foreground">{goal.activity.name}</span>
                    <span className="tabular-nums text-foreground-muted">
                      {achieved}/{goal.targetQuantity}
                      {displayUnit(goal.activity.unit) ? ` ${displayUnit(goal.activity.unit)}` : ""} ({percent}%)
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-soft">
                    <div className={cn("h-full rounded-full", percent >= 100 ? "bg-success" : percent >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                </div>
              ))}
              {goals.length === 0 && <p className="py-3 text-center text-sm text-foreground-subtle">Nenhuma meta definida para este mês.</p>}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{canEdit ? "Lançar e conferir por dia" : "Lançamentos por dia"}</h3>
          <ProductivityCalendarClient
            collaboratorId={id}
            collaboratorName={report.collaborator.name}
            activities={activities}
            canEdit={canEdit}
            layout={period === "mes" ? "grid" : "list"}
            days={report.days.map((d) => ({ date: dayKey(d.date), day: d.date.getDate(), weekday: WEEKDAYS[d.date.getDay()], status: d.status, entries: d.entries }))}
          />
        </section>
      </PageBody>
    </>
  );
}

function Tile({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", danger ? "text-danger" : "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-foreground-subtle">{sub}</p>}
    </div>
  );
}
