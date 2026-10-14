import Link from "next/link";
import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";

type Reporter = { collaboratorId: string; name: string; count: number; turnoName: string | null };

/** Posição "dense": quem empata no número de relatos divide a mesma colocação (1º, 1º, 2º...). */
function withPosition(list: Reporter[]) {
  const counts = [...new Set(list.map((r) => r.count))].sort((a, b) => b - a);
  return list.map((r) => ({ ...r, position: counts.indexOf(r.count) + 1 }));
}

const MEDAL_STYLE: Record<number, string> = {
  1: "bg-warning-soft text-warning",
  2: "bg-neutral-soft text-foreground-muted",
  3: "bg-danger-soft text-danger",
};

function Name({ r, canOpenProfiles, className }: { r: Reporter; canOpenProfiles: boolean; className?: string }) {
  const label = formatPersonName(r.name);
  return canOpenProfiles ? (
    <Link href={`/colaboradores/${r.collaboratorId}`} className={cn("hover:underline", className)}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}

/** Campeões de relatos do mês: o campeão geral em destaque, o pódio (1º ao 3º) e o campeão de cada turno. */
export function GuardianChampions({
  ranking,
  canOpenProfiles,
  monthLabel,
}: {
  ranking: Reporter[];
  canOpenProfiles: boolean;
  monthLabel: string;
}) {
  if (ranking.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-center text-sm text-foreground-subtle">
        Ninguém relatou em {monthLabel} ainda — o primeiro relato leva a coroa.
      </div>
    );
  }

  const ranked = withPosition(ranking);
  const champions = ranked.filter((r) => r.position === 1);
  const podium = ranked.filter((r) => r.position <= 3).slice(0, 9);
  const maxCount = ranked[0].count;

  const turnoMap = new Map<string | null, Reporter[]>();
  for (const r of ranking) turnoMap.set(r.turnoName, [...(turnoMap.get(r.turnoName) ?? []), r]);
  const turnos = [...turnoMap.entries()]
    .map(([turno, list]) => ({ turno, list: withPosition(list) }))
    .sort((a, b) => (a.turno === null ? 1 : b.turno === null ? -1 : a.turno.localeCompare(b.turno, "pt-BR", { numeric: true })));

  return (
    <div className="flex flex-col gap-4">
      {/* Campeão(ões) geral */}
      <div className="relative overflow-hidden rounded-xl border border-warning/40 bg-gradient-to-br from-warning-soft via-surface to-surface p-4 sm:p-5">
        <Trophy className="pointer-events-none absolute -right-3 -top-3 size-28 text-warning/10" aria-hidden />
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
          <Crown className="size-4" /> {champions.length > 1 ? "Campeões de relatos" : "Campeão de relatos"} — {monthLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
          {champions.map((c) => (
            <div key={c.collaboratorId} className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-warning text-white shadow-sm">
                <Trophy className="size-7" />
              </span>
              <div className="min-w-0">
                <Name r={c} canOpenProfiles={canOpenProfiles} className="block truncate text-lg font-bold text-foreground" />
                <p className="text-sm text-foreground-subtle">
                  <span className="text-2xl font-extrabold tabular-nums text-warning">{c.count}</span> relato(s)
                  {c.turnoName && <span> · Turno {c.turnoName}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pódio */}
      {podium.length > champions.length && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-foreground-subtle">Pódio</p>
          {podium.map((r) => (
            <div key={r.collaboratorId} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold", MEDAL_STYLE[r.position])}>
                {r.position === 1 ? <Trophy className="size-4" /> : <Medal className="size-4" />}
              </span>
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-foreground-subtle">{r.position}º</span>
              <div className="min-w-0 flex-1">
                <Name r={r} canOpenProfiles={canOpenProfiles} className="block truncate text-sm font-medium text-foreground" />
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${Math.max(8, Math.round((r.count / maxCount) * 100))}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{r.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Campeão por turno */}
      {turnos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-foreground-subtle">Campeão de cada turno</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {turnos.map(({ turno, list }) => {
              const top = list.filter((r) => r.position === 1);
              const rest = list.filter((r) => r.position > 1).slice(0, 4);
              return (
                <div key={turno ?? "sem-turno"} className="rounded-lg border border-border bg-surface p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">{turno ? `Turno ${turno}` : "Sem turno definido"}</p>
                  {top.map((r) => (
                    <div key={r.collaboratorId} className="mb-2 flex items-center gap-2 rounded-md bg-warning-soft px-2.5 py-2">
                      <Crown className="size-4 shrink-0 text-warning" />
                      <Name r={r} canOpenProfiles={canOpenProfiles} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" />
                      <span className="shrink-0 text-sm font-bold tabular-nums text-warning">{r.count}</span>
                    </div>
                  ))}
                  {rest.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {rest.map((r) => (
                        <li key={r.collaboratorId} className="flex items-center gap-2 text-xs">
                          <span className="w-5 shrink-0 tabular-nums text-foreground-subtle">{r.position}º</span>
                          <Name r={r} canOpenProfiles={canOpenProfiles} className="min-w-0 flex-1 truncate text-foreground" />
                          <span className="shrink-0 tabular-nums text-foreground-subtle">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
