import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Truck } from "lucide-react";
import { addMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { isWarehouseHelper } from "@/domain/production/helpers";
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
  const maxCount = Math.max(...month.byActivity.map((a) => a.count), 1);
  const prev = monthKeyOf(addMonths(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1), -1));
  const next = monthKeyOf(addMonths(new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1, 1), 1));

  return (
    <>
      <PageHeader
        title="Produtividade dos ajudantes"
        description="Lançamentos por pessoa dos ajudantes de armazém. Carros trabalhados, amarrados e carregados, cargas e descargas ficam em Produção, lançados por turno."
        actions={
          <>
            <Link href="/producao" className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted">
              <Truck className="size-4" /> Produção por turno
            </Link>
            <Link href="/lancar-produtividade" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
              <ClipboardList className="size-4" /> Lançar produtividade
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

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Produção por atividade</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <th className="px-3 py-1.5 text-left font-semibold">Atividade</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Lançamentos</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {month.byActivity.map((a) => (
                  <tr key={a.activityId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-1.5 text-foreground">{a.activityName}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-soft">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${(a.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-foreground-muted">{a.count}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">{a.unit ? `${a.totalQuantity.toLocaleString("pt-BR")} ${a.unit}` : "—"}</td>
                  </tr>
                ))}
                {month.byActivity.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-foreground-subtle">Nenhum lançamento neste mês.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <h3 className="border-b border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-foreground">Por ajudante</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <th className="px-3 py-1.5 text-left font-semibold">Ajudante</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Dias com lançamento</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Lançamentos</th>
                </tr>
              </thead>
              <tbody>
                {month.byCollaborator.map((c) => {
                  const cover = pct(c.daysLogged, c.workDays) ?? 0;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-1.5">
                        <Link href={`/lancar-produtividade?collaboratorId=${c.id}&period=mes&ref=${selected}-15`} className="text-foreground hover:text-accent hover:underline">{c.name}</Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-soft">
                            <div className={cn("h-full rounded-full", cover >= 90 ? "bg-success" : cover >= 60 ? "bg-accent" : "bg-warning")} style={{ width: `${Math.min(cover, 100)}%` }} />
                          </div>
                          <span className="whitespace-nowrap text-xs tabular-nums text-foreground-muted">{c.daysLogged}/{c.workDays} ({cover}%)</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">{c.entries}</td>
                    </tr>
                  );
                })}
                {month.byCollaborator.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-foreground-subtle">Nenhum ajudante escalado neste mês.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

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
                        {achieved}/{goal.targetQuantity}{goal.activity.unit ? ` ${goal.activity.unit}` : ""} ({percent}%)
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
