import Link from "next/link";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { addMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { displayUnit, isWarehouseHelper, measuresQuantity } from "@/domain/production/helpers";
import { getAllProductivityGoalsProgress, getProductivityDashboard } from "@/server/services/productivity.service";
import { listActivitiesForUser } from "@/server/services/activity.service";
import { listActiveCollaboratorsForSupervision } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { APP_TIMEZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ProductivityGoalDialog, DeleteProductivityGoalButton } from "../indicadores/productivity-goal-dialog";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} de ${key.slice(0, 4)}`;
const nf = (n: number) => n.toLocaleString("pt-BR");

/** "Separação e seleção de chapatex (VIDROS PARANÁ)" → "Chapatex": o nome cadastrado é longo demais para um card. */
function shortActivityName(name: string): string {
  const n = name.replace(/\s*\(.*$/, "").replace(/^separa[cç][aã]o e sele[cç][aã]o de\s+/i, "").replace(/\.$/, "").trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export default async function ProdutividadePage({ searchParams }: { searchParams: Promise<{ periodo?: string; atividade?: string }> }) {
  const user = await requireUser();
  const { periodo, atividade } = await searchParams;
  const currentKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const selected = periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : currentKey;
  const isCurrent = selected === currentKey;
  const year = Number(selected.slice(0, 4));
  const monthNumber = Number(selected.slice(5, 7));
  const refDate = new Date(year, monthNumber - 1, isCurrent ? new Date().getDate() : 15);
  const canManage = hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE);

  const [dashboard, goals, activities, allCollaborators] = await Promise.all([
    getProductivityDashboard(user, { date: refDate }),
    getAllProductivityGoalsProgress(user, { month: monthNumber, year }),
    canManage ? listActivitiesForUser(user) : Promise.resolve([]),
    canManage ? listActiveCollaboratorsForSupervision(user) : Promise.resolve([]),
  ]);
  const helpers = allCollaborators.filter(isWarehouseHelper);
  const { month, today } = dashboard;

  // Uma atividade por vez. Atividade sem quantidade (ex.: 5S) é medida pelo número de lançamentos.
  const act = month.byActivity.find((a) => a.activityId === atividade) ?? month.byActivity[0] ?? null;
  const useQuantity = !!act && measuresQuantity({ name: act.activityName, unit: act.unit });
  const unit = act && useQuantity ? displayUnit(act.unit) : null;
  const metricLabel = useQuantity ? (unit ?? "quantidade") : "vezes que foi feito";
  const valueOf = (q: Record<string, number>, c: Record<string, number>) => (act ? (useQuantity ? q[act.activityId] : c[act.activityId]) ?? 0 : 0);

  const ranking = act
    ? month.byCollaborator
        .map((c) => ({ id: c.id, name: c.name, value: valueOf(c.quantityByActivity, c.countByActivity), daysLogged: c.daysLogged, workDays: c.workDays }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"))
    : [];
  const rankingTotal = ranking.reduce((s, r) => s + r.value, 0);
  const rankingMax = Math.max(...ranking.map((r) => r.value), 1);

  const lastDay = isCurrent ? new Date().getDate() : new Date(year, monthNumber, 0).getDate();
  const byDay = new Map(month.byDay.map((d) => [d.day, d]));
  const daily = Array.from({ length: lastDay }, (_, i) => {
    const day = `${selected}-${String(i + 1).padStart(2, "0")}`;
    const d = byDay.get(day);
    return { n: i + 1, value: d && act ? valueOf(d.quantityByActivity, d.countByActivity) : 0 };
  });

  const idle = month.byCollaborator.filter((c) => c.entries === 0);
  const prev = monthKeyOf(addMonths(new Date(year, monthNumber - 1, 1), -1));
  const next = monthKeyOf(addMonths(new Date(year, monthNumber - 1, 1), 1));
  const personHref = (id: string) => `/produtividade/${id}?period=mes&ref=${selected}-15`;
  const activityHref = (id: string) => `/produtividade?periodo=${selected}&atividade=${id}`;

  return (
    <>
      <PageHeader
        title="Produtividade dos ajudantes"
        description="Escolha uma atividade para ver quem produziu mais e como foi dia a dia. Clique no nome para abrir a pessoa. Carros e descargas ficam em Produção."
        actions={
          <Link href="/producao" className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted">
            <Truck className="size-4" /> Produção por turno
          </Link>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/produtividade?periodo=${prev}`} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted">
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-40 text-center text-sm font-semibold capitalize text-foreground">{monthLabel(selected)}</span>
            <Link href={`/produtividade?periodo=${next}`} aria-label="Próximo mês" className={cn("inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted", isCurrent && "pointer-events-none opacity-40")}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <p className="text-sm text-foreground-muted">
            <span className="font-semibold text-foreground">{month.collaboratorsLogged}</span> de {month.collaboratorsScheduled} ajudantes com lançamento
            {" · "}
            <span className="font-semibold text-foreground">{month.totalEntries}</span> lançamentos
            {isCurrent && (
              <>
                {" · "}hoje <span className="font-semibold text-foreground">{today.collaboratorsLogged}</span> de {today.collaboratorsScheduled}
              </>
            )}
          </p>
        </div>

        {isCurrent && today.missingCollaborators.length > 0 && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Escalados hoje e ainda sem lançamento: {today.missingCollaborators.map((c) => c.name).join(", ")}.
          </p>
        )}

        {month.byActivity.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">Nenhum lançamento em {monthLabel(selected)}.</div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {month.byActivity.map((a) => {
                const on = act?.activityId === a.activityId;
                const qty = measuresQuantity({ name: a.activityName, unit: a.unit });
                const people = month.byCollaborator.filter((c) => (qty ? c.quantityByActivity[a.activityId] : c.countByActivity[a.activityId])).length;
                return (
                  <Link
                    key={a.activityId}
                    href={activityHref(a.activityId)}
                    title={a.activityName}
                    className={cn("rounded-md border px-3 py-2.5 transition-colors", on ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-muted")}
                  >
                    <p className="line-clamp-2 min-h-8 text-xs font-medium text-foreground">{shortActivityName(a.activityName)}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{qty ? nf(a.totalQuantity) : nf(a.count)}</p>
                    <p className="text-[11px] text-foreground-subtle">
                      {qty ? (displayUnit(a.unit) ?? "no mês") : "vezes no mês"} · {people} {people === 1 ? "pessoa" : "pessoas"}
                    </p>
                  </Link>
                );
              })}
            </section>

            {act && (
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="overflow-hidden rounded-md border border-border bg-surface">
                  <div className="border-b border-border bg-surface-muted px-3 py-2">
                    <h3 className="text-sm font-semibold text-foreground">Quem mais produziu: {shortActivityName(act.activityName)}</h3>
                    <p className="text-[11px] text-foreground-subtle">Total do mês por pessoa ({metricLabel}) e a parte de cada um.</p>
                  </div>
                  <ul>
                    {ranking.map((r, i) => (
                      <li key={r.id} className="border-b border-border px-3 py-2 last:border-b-0">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="mr-2 inline-block w-5 text-right text-xs tabular-nums text-foreground-subtle">{i + 1}</span>
                            <Link href={personHref(r.id)} className="font-medium text-foreground hover:text-accent hover:underline">{r.name}</Link>
                          </span>
                          <span className="shrink-0 tabular-nums text-foreground">
                            <span className="font-semibold">{nf(r.value)}</span>
                            <span className="ml-1.5 text-xs text-foreground-subtle">{rankingTotal > 0 ? `${Math.round((r.value / rankingTotal) * 100)}%` : ""}</span>
                          </span>
                        </div>
                        <div className="ml-7 mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((r.value / rankingMax) * 100, 2)}%` }} />
                        </div>
                      </li>
                    ))}
                    {ranking.length === 0 && <li className="px-3 py-6 text-center text-sm text-foreground-subtle">Ninguém lançou esta atividade no mês.</li>}
                  </ul>
                  {ranking.length > 0 && (
                    <p className="border-t border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground-muted">
                      Total: <span className="font-semibold text-foreground">{nf(rankingTotal)}</span> {metricLabel}
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-border bg-surface">
                  <div className="border-b border-border bg-surface-muted px-3 py-2">
                    <h3 className="text-sm font-semibold text-foreground">Dia a dia</h3>
                    <p className="text-[11px] text-foreground-subtle">Soma de todos os ajudantes em cada dia ({metricLabel}).</p>
                  </div>
                  <div className="p-3">
                    <DailyBars days={daily} />
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {idle.length > 0 && (
          <details className="rounded-md border border-border bg-surface px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Sem nenhum lançamento em {monthLabel(selected)} ({idle.length})</summary>
            <p className="mb-1.5 mt-2 text-[11px] text-foreground-subtle">Estavam escalados, mas nenhuma produção foi lançada no nome deles.</p>
            <p className="text-sm text-foreground-muted">
              {idle.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <Link href={personHref(c.id)} className="hover:text-accent hover:underline">{c.name}</Link>
                </span>
              ))}
            </p>
          </details>
        )}

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 bg-surface-muted px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Metas de {monthLabel(selected)} ({goals.length})</h3>
            {canManage && <ProductivityGoalDialog collaborators={helpers} activities={activities} month={monthNumber} year={year} />}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-t border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-1.5 text-left font-semibold">Ajudante</th>
                <th className="px-3 py-1.5 text-left font-semibold">Atividade</th>
                <th className="px-3 py-1.5 text-left font-semibold">Progresso</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {goals.map(({ goal, achieved, percent }) => (
                <tr key={goal.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-1.5 text-foreground">{goal.collaborator.name}</td>
                  <td className="px-3 py-1.5 text-foreground-muted">{shortActivityName(goal.activity.name)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-soft">
                        <div className={cn("h-full rounded-full", percent >= 100 ? "bg-success" : percent >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <span className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">
                        {achieved}/{goal.targetQuantity}
                        {displayUnit(goal.activity.unit) ? ` ${displayUnit(goal.activity.unit)}` : ""} ({percent}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <ProductivityGoalDialog collaborators={helpers} activities={activities} month={monthNumber} year={year} goal={goal} />
                        <DeleteProductivityGoalButton id={goal.id} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {goals.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-foreground-subtle">Nenhuma meta definida neste mês.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </PageBody>
    </>
  );
}

function DailyBars({ days }: { days: { n: number; value: number }[] }) {
  const W = 640;
  const H = 190;
  const top = 16;
  const bottom = 22;
  const max = Math.max(...days.map((d) => d.value), 1);
  const plotH = H - top - bottom;
  const groupW = W / Math.max(days.length, 1);
  const barW = Math.max(Math.min(18, groupW - 3), 2);
  const y = (v: number) => top + (1 - v / max) * plotH;
  const showValues = days.length <= 16;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Produção por dia">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" />
      <text x={0} y={10} fontSize={9} fill="var(--foreground-subtle)">máx. {nf(max)}</text>
      {days.map((d, i) => {
        const x = i * groupW + (groupW - barW) / 2;
        return (
          <g key={d.n}>
            {d.value > 0 && <rect x={x} y={y(d.value)} width={barW} height={Math.max(y(0) - y(d.value), 1)} rx={2} fill="var(--accent)" />}
            {showValues && d.value > 0 && (
              <text x={x + barW / 2} y={y(d.value) - 3} textAnchor="middle" fontSize={8} fill="var(--foreground-muted)">{nf(d.value)}</text>
            )}
            {(days.length <= 16 || d.n % 2 === 1) && (
              <text x={i * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--foreground-subtle)">{d.n}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
