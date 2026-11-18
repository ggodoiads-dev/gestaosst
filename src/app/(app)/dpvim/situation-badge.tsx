import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DPVIM_SITUATION_LABEL, formatHours, type DpvimSituation } from "@/domain/dpvim/rules";

const TONE: Record<DpvimSituation, BadgeTone> = {
  ATRASADA: "danger",
  VENCE_LOGO: "warning",
  NO_PRAZO: "success",
  CONCLUIDA_NO_PRAZO: "success",
  CONCLUIDA_ATRASADA: "warning",
  CANCELADA: "neutral",
};

/** Situação frente ao prazo de 48h, com quanto falta (ou quanto passou). */
export function SituationBadge({ situation, hoursLeft }: { situation: DpvimSituation; hoursLeft: number | null }) {
  const extra = hoursLeft === null ? "" : hoursLeft < 0 ? ` há ${formatHours(hoursLeft)}` : ` · falta ${formatHours(hoursLeft)}`;
  return (
    <Badge tone={TONE[situation]} dot>
      {DPVIM_SITUATION_LABEL[situation]}
      {extra}
    </Badge>
  );
}

/** Sem a quantidade da nota (quem lança não vê, ou ainda não foi informada), só mostra quanto foi contado. */
export function ProgressBar({ done, expected, progress }: { done: number; expected: number | null; progress: number | null }) {
  if (expected === null || progress === null) {
    return <span className="text-[11px] tabular-nums text-foreground-subtle">{done} contados</span>;
  }
  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={progress >= 100 ? "h-full rounded-full bg-success" : "h-full rounded-full bg-accent"} style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-foreground-subtle">
        {done} contados · norte {expected}
      </span>
    </div>
  );
}
