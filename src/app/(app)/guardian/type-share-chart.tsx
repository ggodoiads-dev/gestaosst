import type { GuardianReportType } from "@/generated/prisma/enums";
import { guardianTypeShares } from "@/domain/guardian/labels";
import { cn } from "@/lib/utils";

const COLOR: Record<GuardianReportType, { bar: string; dot: string }> = {
  COMPORTAMENTO_RISCO: { bar: "bg-warning", dot: "bg-warning" },
  CONDICAO: { bar: "bg-danger", dot: "bg-danger" },
  INCIDENTE: { bar: "bg-info", dot: "bg-info" },
  RECONHECIMENTO: { bar: "bg-success", dot: "bg-success" },
};

/** Percentual de cada tipo de relato sobre o total do mês (até agora, ou fechado: aí vem do mês travado e não muda mais). */
export function TypeShareChart({ byType, frozen, monthLabel }: { byType: { type: GuardianReportType; count: number }[]; frozen: boolean; monthLabel: string }) {
  const shares = guardianTypeShares(byType);
  const total = shares.reduce((s, t) => s + t.count, 0);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Relatos por tipo (%)</p>
        <p className="text-xs text-foreground-subtle">
          {total} relato(s) em {monthLabel}
          {frozen ? " · mês fechado, valores travados" : " · até agora, muda a cada importação"}
        </p>
      </div>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-muted" role="img" aria-label="Distribuição dos relatos por tipo">
        {shares.filter((s) => s.count > 0).map((s) => (
          <div key={s.type} className={cn("h-full", COLOR[s.type].bar)} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.pct}%`} />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {shares.map((s) => (
          <li key={s.type} className="flex items-center gap-3">
            <span className={cn("size-3 shrink-0 rounded-full", COLOR[s.type].dot)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-foreground">{s.label}</span>
                <span className="shrink-0 tabular-nums">
                  <strong className="font-semibold text-foreground">{String(s.pct).replace(".", ",")}%</strong> <span className="text-xs text-foreground-subtle">({s.count})</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className={cn("h-full rounded-full", COLOR[s.type].bar)} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
