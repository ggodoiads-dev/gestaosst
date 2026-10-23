import Link from "next/link";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { addMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { displayUnit, isWarehouseHelper } from "@/domain/production/helpers";
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
/** "Separação e seleção de chapatex" → "Chapatex": o nome cadastrado é longo demais para título de coluna. */
function shortActivityName(name: string): string {
  const n = name.replace(/\s*\(.*$/, "").replace(/^separa[cç][aã]o e sele[cç][aã]o de\s+/i, "").replace(/\.$/, "").trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}
const pct = (part: number, total: number) => (total === 0 ? null : Math.round((part / total) * 100));

export default async function ProdutividadePage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser();
  const { periodo } = await searchParams;
  const currentKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM");
  const selected = periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : currentKey;
  const refDate = new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, selected === currentKey ? new Date().getDate() : 15);
  const isCurrent = selected === currentKey;
  const canManage = hasPermission(user, PERMISSIONS.PRODUCTIVITY_MANAGE);

  const [dashboard, goals, activities, allCollaborators] = await Promise.all([
    getProductivityDashboard(user, { date: refDate }),
    getAllProductivityGoalsProgress(user, { month: Number(selected.slice(5, 7)), year: Number(selected.slice(0, 4)) }),
    canManage ? listActivitiesForUser(user) : Promise.resolve([]),
    canManage ? listActiveCollaboratorsForSupervision(user) : Promise.resolve([]),
  ]);
  const helpers = allCollaborators.filter(isWarehouseHelper);
  const { month, today } = dashboard;
  const adherence = pct(month.collaboratorsLogged, month.collaboratorsScheduled);
  const producers = month.byCollaborator.filter((c) => c.entries > 0);
  const idle = month.byCollaborator.filter((c) => c.entries === 0);
  const prev = monthKeyOf(addMonths(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1), -1));
  const next = monthKeyOf(addMonths(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1), 1));

  return (
    <>
      <PageHeader
        title="Produtividade dos ajudantes"
        description="Produção de cada ajudante de armazém. Clique no nome para ver o dia a dia, as metas e lançar. Carros e descargas ficam em Produção, lançados por turno."
        actions={
          <>
            <Link href="/producao" className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted">
              <Truck className="size-4" /> Produção por turno
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="flex items-center gap-2">
          <Link href={`/produtividade?periodo=${prev}`} aria-label="Mês anterior" className="inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-40 text-center text-sm font-semibold capitalize text-foreground">{monthLabel(selected)}</span>
          <Link href={`/produtividade?periodo=${next}`} aria-label="Próximo mês" className={cn("inline-flex size-9 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted", isCurrent && "pointer-events-none opacity-40")}>
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Ajudantes escalados" value={String(month.collaboratorsScheduled)} sub={`${month.workDays} dias de trabalho no mês`} />
          <Tile label="Lançaram no mês" value={String(month.collaboratorsLogged)} sub={adherence === null ? undefined : `${adherence}% dos escalados`} />
          <Tile label="Lançamentos" value={String(month.totalEntries)} sub="soma de todas as atividades" />
          {isCurrent ? (
            <Tile label="Hoje" value={`${today.collaboratorsLogged}/${today.collaboratorsScheduled}`} sub={today.missingCollaborators.length === 0 ? "todos já lançaram" : `${today.missingCollaborators.length} ainda sem lançamento`} />
          ) : (
            <Tile label="Sem lançamento" value={String(month.missingCollaborators.length)} sub="escalados que não lançaram nada" />
          )}
        </section>

        {isCurrent && today.missingCollaborators.length > 0 && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Escalados hoje e ainda sem lançamento: {today.missingCollaborators.map((c) => c.name).join(", ")}.
          </p>
        )}

        <section className="overflow-x-auto rounded-md border border-border bg-surface">
          <div className="border-b border-border bg-surface-muted px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Quem produziu em {monthLabel(selected)}</h3>
            <p className="text-[11px] text-foreground-subtle">Quantidade lançada por pessoa em cada atividade. Clique no nome para ver o dia a dia.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                <th className="px-3 py-1.5 text-left font-semibold">Ajudante</th>
                {month.byActivity.map((a) => (
                  <th key={a.activityId} title={a.activityName} className="px-2 py-1.5 text-right align-bottom font-semibold">
                    <span className="line-clamp-3 max-w-28 normal-case tracking-normal">{shortActivityName(a.activityName)}</span>
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right font-semibold">Dias lançados</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {producers.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-muted">
                  <td className="px-3 py-1.5">
                    <Link href={`/produtividade/${c.id}?period=mes&ref=${selected}-15`} className="font-medium text-foreground hover:text-accent hover:underline">{c.name}</Link>
                  </td>
                  {month.byActivity.map((a) => (
                    <td key={a.activityId} className="px-2 py-1.5 text-right tabular-nums text-foreground">
                      {c.quantityByActivity[a.activityId] ? c.quantityByActivity[a.activityId].toLocaleString("pt-BR") : <span className="text-foreground-subtle">—</span>}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs tabular-nums text-foreground-muted">{c.daysLogged} de {c.workDays}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Link href={`/produtividade/${c.id}?period=mes&ref=${selected}-15`} aria-label={`Abrir ${c.name}`} className="text-foreground-subtle hover:text-accent"><ChevronRight className="size-4" /></Link>
                  </td>
                </tr>
              ))}
              {producers.length === 0 && (
                <tr>
                  <td colSpan={3 + month.byActivity.length} className="px-3 py-6 text-center text-foreground-subtle">Nenhum lançamento neste mês.</td>
                </tr>
              )}
            </tbody>
            {producers.length > 0 && (
              <tfoot>
                <tr className="bg-surface-muted font-semibold">
                  <td className="px-3 py-1.5 text-foreground">Total do mês</td>
                  {month.byActivity.map((a) => (
                    <td key={a.activityId} className="px-2 py-1.5 text-right tabular-nums text-foreground">{a.totalQuantity.toLocaleString("pt-BR")}</td>
                  ))}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        {idle.length > 0 && (
          <section className="rounded-md border border-border bg-surface px-3 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">Sem lançamento em {monthLabel(selected)} ({idle.length})</h3>
            <p className="mb-1.5 text-[11px] text-foreground-subtle">Estavam escalados, mas nenhuma produção foi lançada no nome deles.</p>
            <p className="text-sm text-foreground-muted">
              {idle.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <Link href={`/produtividade/${c.id}?period=mes&ref=${selected}-15`} className="hover:text-accent hover:underline">{c.name}</Link>
                </span>
              ))}
            </p>
          </section>
        )}

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-surface-muted px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Metas de {monthLabel(selected)}</h3>
            {canManage && <ProductivityGoalDialog collaborators={helpers} activities={activities} month={Number(selected.slice(5, 7))} year={Number(selected.slice(0, 4))} />}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
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
                  <td className="px-3 py-1.5 text-foreground-muted">{goal.activity.name}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-soft">
                        <div className={cn("h-full rounded-full", percent >= 100 ? "bg-success" : percent >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <span className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">
                        {achieved}/{goal.targetQuantity}{displayUnit(goal.activity.unit) ? ` ${displayUnit(goal.activity.unit)}` : ""} ({percent}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <ProductivityGoalDialog collaborators={helpers} activities={activities} month={Number(selected.slice(5, 7))} year={Number(selected.slice(0, 4))} goal={goal} />
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

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-foreground-subtle">{sub}</p>}
    </div>
  );
}
