"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName, initials } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { markWarningAppliedAction, markAbsenceInterviewDoneAction } from "@/server/actions/schedule.actions";
import { CreateWarningDialog } from "@/app/(app)/colaboradores/[id]/warning-dialog";

export type FollowUpItem = {
  noteId: string;
  collaboratorId: string;
  collaboratorName: string;
  dateLabel: string;
  weekday: string;
  notes: string;
  warningApplied: boolean;
  absenceInterviewDone: boolean;
};

type Filter = "todas" | "advertencia" | "entrevista";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function FollowUpCard({ item }: { item: FollowUpItem }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-xs font-semibold text-danger">
          {initials(item.collaboratorName)}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/colaboradores/${item.collaboratorId}`} className="text-sm font-semibold text-foreground hover:underline">
            {formatPersonName(item.collaboratorName)}
          </Link>
          <p className="text-xs text-foreground-subtle">
            Falta em {item.weekday}, {item.dateLabel}
          </p>
          {item.notes && <p className="mt-1 text-xs text-foreground-muted">“{item.notes}”</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StepRow
          label="Advertência"
          done={item.warningApplied}
          doneText="Aplicada"
          todoText="Pendente"
          disabled={pending}
          onToggle={() => run(() => markWarningAppliedAction(item.noteId, !item.warningApplied))}
          actionLabel={item.warningApplied ? "Desfazer" : "Marcar como aplicada"}
        />
        <StepRow
          label="Entrevista de ABS"
          done={item.absenceInterviewDone}
          doneText="Feita"
          todoText="Pendente"
          disabled={pending}
          onToggle={() => run(() => markAbsenceInterviewDoneAction(item.noteId, !item.absenceInterviewDone))}
          actionLabel={item.absenceInterviewDone ? "Desfazer" : "Marcar como feita"}
        />
      </div>

      {!item.warningApplied && (
        <div className="flex justify-end border-t border-border pt-3">
          <CreateWarningDialog collaboratorId={item.collaboratorId} />
        </div>
      )}
    </div>
  );
}

function StepRow({
  label,
  done,
  doneText,
  todoText,
  disabled,
  onToggle,
  actionLabel,
}: {
  label: string;
  done: boolean;
  doneText: string;
  todoText: string;
  disabled: boolean;
  onToggle: () => void;
  actionLabel: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2", done ? "bg-success-soft" : "bg-warning-soft")}>
      <div className="min-w-0">
        <p className="text-xs text-foreground-subtle">{label}</p>
        <p className={cn("flex items-center gap-1 text-sm font-medium", done ? "text-success" : "text-warning")}>
          {done && <Check className="size-3.5" />}
          {done ? doneText : todoText}
        </p>
      </div>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onToggle}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function PendingFollowUpList({ items }: { items: FollowUpItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");

  const withoutWarning = items.filter((i) => !i.warningApplied).length;
  const withoutInterview = items.filter((i) => !i.absenceInterviewDone).length;

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (!query || normalize(i.collaboratorName).includes(normalize(query))) &&
          (filter === "todas" || (filter === "advertencia" ? !i.warningApplied : !i.absenceInterviewDone)),
      ),
    [items, query, filter],
  );

  const tiles: { key: Filter; label: string; value: number; tone: string; ring: string }[] = [
    { key: "todas", label: "Faltas com pendência", value: items.length, tone: "text-foreground", ring: "border-accent" },
    { key: "advertencia", label: "Sem advertência", value: withoutWarning, tone: "text-danger", ring: "border-danger" },
    { key: "entrevista", label: "Sem entrevista de ABS", value: withoutInterview, tone: "text-warning", ring: "border-warning" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(filter === t.key ? "todas" : t.key)}
            aria-pressed={filter === t.key}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-lg border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
              filter === t.key ? cn("border-2", t.ring) : "border-border",
            )}
          >
            <span className={cn("text-2xl font-semibold tabular-nums leading-none", t.tone)}>{t.value}</span>
            <span className="text-xs text-foreground-subtle">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar colaborador..."
          className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          {items.length === 0 ? "Tudo em dia — nenhuma falta com pendência." : "Ninguém encontrado com esse filtro."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {shown.map((item) => (
            <FollowUpCard key={item.noteId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
