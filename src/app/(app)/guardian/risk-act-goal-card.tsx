import Link from "next/link";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import { goalProgress, type GoalPerson } from "@/domain/guardian/goal";
import { Badge } from "@/components/ui/badge";

/** Meta mensal: 2 relatos de ato inseguro (comportamento de risco) por pessoa. Mostra quantos bateram, o quanto da meta total foi cumprida e quem falta. */
export function RiskActGoalCard({
  goal,
  canOpenProfiles,
  periodLabel,
}: {
  goal: { target: number; people: GoalPerson[] };
  canOpenProfiles: boolean;
  periodLabel: string;
}) {
  const p = goalProgress(goal.people, goal.target);
  const pending = goal.people.filter((x) => x.count < goal.target).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const tone = p.coveragePct >= 100 ? "text-success" : p.coveragePct >= 50 ? "text-warning" : "text-danger";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Target className="size-4 text-accent" /> Meta de relatos — ato inseguro
        </p>
        <p className="text-xs text-foreground-subtle">
          {goal.target} relatos de comportamento de risco por pessoa · {periodLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-foreground-subtle">Bateram a meta</p>
          <p className={cn("text-2xl font-semibold tabular-nums", tone)}>
            {p.reached}
            <span className="text-sm font-normal text-foreground-subtle"> de {p.people}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-foreground-subtle">% das pessoas</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{p.reachedPct}%</p>
        </div>
        <div>
          <p className="text-xs text-foreground-subtle">Meta do grupo cumprida</p>
          <p className={cn("text-2xl font-semibold tabular-nums", tone)}>{p.coveragePct}%</p>
        </div>
        <div>
          <p className="text-xs text-foreground-subtle">Relatos que contam</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {p.counted}
            <span className="text-sm font-normal text-foreground-subtle"> de {p.expected}</span>
          </p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={cn("h-full rounded-full", p.coveragePct >= 100 ? "bg-success" : p.coveragePct >= 50 ? "bg-warning" : "bg-danger")} style={{ width: `${Math.min(100, p.coveragePct)}%` }} />
      </div>

      {pending.length > 0 ? (
        <details className="rounded-md border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">Quem ainda não bateu a meta ({pending.length})</summary>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {pending.map((x) => (
              <li key={x.collaboratorId} className="flex items-center justify-between gap-2">
                {canOpenProfiles ? (
                  <Link href={`/colaboradores/${x.collaboratorId}`} className="truncate text-accent hover:underline">
                    {formatPersonName(x.name)}
                  </Link>
                ) : (
                  <span className="truncate">{formatPersonName(x.name)}</span>
                )}
                <Badge tone={x.count === 0 ? "danger" : "warning"}>
                  {x.count}/{goal.target}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        p.people > 0 && <p className="text-xs font-medium text-success">Todo mundo bateu a meta.</p>
      )}
    </div>
  );
}
