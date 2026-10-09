import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatPersonName } from "@/lib/format-name";
import type { getDtoCalendar } from "@/server/services/dto-calendar.service";

type Calendar = Awaited<ReturnType<typeof getDtoCalendar>>;

function dm(key: string) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function href(week: string, perDay: number) {
  return `/dto?aba=calendario&semana=${week}&pordia=${perDay}`;
}

const KIND_LABEL = { novo: "Novo", nunca: "Nunca avaliado", tempo: "" } as const;

/** Calendário semanal (segunda a sexta): quem deve receber DTO em cada dia. */
export function DtoCalendar({ calendar }: { calendar: Calendar }) {
  const { weekStart, weekEnd, perDay } = calendar;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" asChild>
            <Link href={href(calendar.prevWeek, perDay)} aria-label="Semana anterior"><ChevronLeft className="size-4" /></Link>
          </Button>
          <span className="min-w-44 text-center text-sm font-medium text-foreground">
            {dm(weekStart)} a {dm(weekEnd)}/{weekEnd.slice(0, 4)}
          </span>
          {calendar.nextWeek ? (
            <Button size="icon" variant="secondary" asChild>
              <Link href={href(calendar.nextWeek, perDay)} aria-label="Próxima semana"><ChevronRight className="size-4" /></Link>
            </Button>
          ) : (
            <Button size="icon" variant="secondary" disabled aria-label="Próxima semana"><ChevronRight className="size-4" /></Button>
          )}
          {!calendar.isCurrentWeek && (
            <Button size="sm" variant="secondary" asChild>
              <Link href={href(calendar.currentMonday, perDay)}>Esta semana</Link>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-foreground-subtle">
          DTOs por dia:
          <div className="flex overflow-hidden rounded-md border border-border-strong">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Link
                key={n}
                href={href(weekStart, n)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium",
                  n === perDay ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
                )}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-foreground-subtle">
        Distribuição automática a partir de hoje entre os {calendar.eligibleTotal} colaboradores ativos que são avaliados (ADM/liderança fora): cada um
        no dia em que trabalha, respeitando os 60 dias entre DTOs, e com a liderança da área/turno dele (quem faz a chamada dele) que trabalha nesse dia, dividindo a carga entre elas. Ordem: novos, nunca avaliados e quem está há mais tempo sem DTO.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {calendar.days.map((day) => (
          <div
            key={day.dayKey}
            className={cn("flex flex-col gap-2 rounded-lg border bg-surface p-3", day.isToday ? "border-2 border-accent" : "border-border", day.isPast && "opacity-80")}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-foreground">{day.weekday}</p>
              <p className="text-xs text-foreground-subtle">
                {dm(day.dayKey)}
                {day.isToday && " · hoje"}
              </p>
            </div>

            {day.done.map((d) => (
              <div key={d.id} className="flex items-start gap-1.5 rounded-md bg-success-soft px-2 py-1.5">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{formatPersonName(d.collaboratorName)}</p>
                  <p className="truncate text-[11px] text-foreground-subtle">
                    {d.activity}
                    {d.scorePercent !== null && ` · ${d.scorePercent}%`}
                  </p>
                </div>
              </div>
            ))}

            {day.planned.map((p) => (
              <div key={p.collaboratorId} className="rounded-md border border-border px-2 py-1.5">
                <p className="truncate text-xs font-medium text-foreground">{formatPersonName(p.name)}</p>
                <p className="truncate text-[11px] text-foreground-subtle">
                  {[p.areaName, p.functionName && formatPersonName(p.functionName)].filter(Boolean).join(" · ") || "Sem área"}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-medium",
                    p.kind === "novo" ? "text-info" : p.kind === "nunca" ? "text-danger" : "text-warning",
                  )}
                >
                  {p.kind === "novo"
                    ? `${KIND_LABEL.novo} · ${p.tenureDays} dia(s) de casa`
                    : p.kind === "nunca"
                      ? KIND_LABEL.nunca
                      : `Há ${p.daysSince} dias sem DTO`}
                </p>
                <p className={cn("truncate text-[11px]", p.leaderName ? "text-foreground-muted" : "text-danger")}>
                  {p.leaderName ? `Com: ${formatPersonName(p.leaderName)}` : "Sem liderança definida"}
                </p>
              </div>
            ))}

            {day.done.length === 0 && day.planned.length === 0 && (
              <p className="text-xs text-foreground-subtle">{day.isPast ? "Nenhum DTO feito." : "Ninguém escalado."}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
