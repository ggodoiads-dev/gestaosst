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
import { requestAbsenceInterviewAction } from "@/server/actions/absence-interview.actions";
import { CreateWarningDialog } from "@/app/(app)/colaboradores/[id]/warning-dialog";
import { BulkDismissButton, DeleteNoteButton, DismissNoteButton, WarningDocuments } from "./followup-tools";
import { bulkFollowUpAction } from "@/server/actions/absence-followup.actions";
import { MeasureDialog, type DisciplineEntry } from "./discipline-section";
import { disciplineStepLabel } from "@/domain/discipline/ladder";

export type FollowUpItem = {
  noteId: string;
  kind: "FALTA" | "ATESTADO";
  attachments: { id: string; filename: string; path: string }[];
  interview: { id: string; status: "SOLICITADA" | "RESPONDIDA" | "CONCLUIDA" } | null;
  collaboratorId: string;
  collaboratorName: string;
  dateLabel: string;
  weekday: string;
  notes: string;
  warningApplied: boolean;
  absenceInterviewDone: boolean;
  /** Falta: medida sugerida pela escada de falta injustificada (null se a tabela de medidas ainda não existe). */
  discipline: DisciplineEntry | null;
};

type Filter = "todas" | "advertencia" | "entrevista";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function FollowUpCard({ item, selected, onSelect, canHr }: { item: FollowUpItem; selected: boolean; onSelect: (value: boolean) => void; canHr: boolean }) {
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
    <div className={cn("flex flex-col gap-3 p-4", selected && "bg-accent/5")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          aria-label={`Selecionar ${item.kind === "ATESTADO" ? "atestado" : "falta"} de ${item.dateLabel}`}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {item.kind === "ATESTADO" ? "Atestado" : "Falta"} em {item.weekday}, {item.dateLabel}
          </p>
          {item.notes && <p className="mt-1 text-xs text-foreground-muted">“{item.notes}”</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {item.kind === "FALTA" && (
          <StepRow
            label="Advertência"
            done={item.warningApplied}
            doneText="Aplicada"
            todoText="Pendente"
            disabled={pending}
            onToggle={() => run(() => markWarningAppliedAction(item.noteId, !item.warningApplied))}
            actionLabel={item.warningApplied ? "Desfazer" : "Marcar como aplicada"}
          />
        )}
        {canHr && <InterviewStep item={item} pending={pending} run={run} />}
      </div>

      {item.kind === "FALTA" && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground-subtle">Documento da advertência (o colaborador vê o que você anexar)</p>
          <WarningDocuments noteId={item.noteId} attachments={item.attachments} canAttach />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        {canHr ? (
        <DeleteNoteButton
          noteId={item.noteId}
          label={`${item.kind === "ATESTADO" ? "Atestado" : "Falta"} de ${formatPersonName(item.collaboratorName)} em ${item.weekday}, ${item.dateLabel}`}
        />
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {item.discipline && (
            <MeasureDialog
              entry={item.discipline}
              mode="apply"
              trigger={<Button size="sm">Registrar medida · {disciplineStepLabel(item.discipline.suggestedStep)}</Button>}
            />
          )}
          <DismissNoteButton
            noteId={item.noteId}
            kind={item.kind}
            label={`${item.kind === "ATESTADO" ? "Atestado" : "Falta"} de ${formatPersonName(item.collaboratorName)} em ${item.weekday}, ${item.dateLabel}`}
          />
          {item.kind === "FALTA" && !item.warningApplied && <CreateWarningDialog collaboratorId={item.collaboratorId} />}
        </div>
      </div>
    </div>
  );
}

function InterviewStep({
  item,
  pending,
  run,
}: {
  item: FollowUpItem;
  pending: boolean;
  run: (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  const router = useRouter();
  const state = item.interview?.status;
  if (item.absenceInterviewDone || state === "CONCLUIDA") {
    return (
      <StepRow
        label="Entrevista de ABS"
        done
        doneText="Feita"
        todoText=""
        disabled={pending}
        onToggle={() => run(() => markAbsenceInterviewDoneAction(item.noteId, false))}
        actionLabel="Desfazer"
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-foreground-subtle">Entrevista de ABS</p>
        <p className="text-sm font-medium text-warning">
          {state === "SOLICITADA" ? "Aguardando o colaborador" : state === "RESPONDIDA" ? "Aguardando sua avaliação" : "Pendente"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {item.interview ? (
          <Link
            href={`/entrevistas-abs/${item.interview.id}`}
            className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-neutral-soft"
          >
            {state === "RESPONDIDA" ? "Avaliar" : "Abrir"}
          </Link>
        ) : (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await requestAbsenceInterviewAction(item.noteId);
                  if (res.ok && res.id) router.push(`/entrevistas-abs/${res.id}`);
                  return res;
                })
              }
            >
              Pedir entrevista
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => markAbsenceInterviewDoneAction(item.noteId, true))}
            >
              Marcar como feita
            </Button>
          </>
        )}
      </div>
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

export function PendingFollowUpList({ items, canHr }: { items: FollowUpItem[]; canHr: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  const withoutWarning = items.filter((i) => i.kind === "FALTA" && !i.warningApplied).length;
  const withoutInterview = items.filter((i) => !i.absenceInterviewDone).length;

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (!query || normalize(i.collaboratorName).includes(normalize(query))) &&
          (filter === "todas" || (filter === "advertencia" ? i.kind === "FALTA" && !i.warningApplied : !i.absenceInterviewDone)),
      ),
    [items, query, filter],
  );

  // Uma pessoa por linha: todas as pendências dela ficam juntas, da mais recente pra mais antiga (a lista já vem ordenada).
  const groups = useMemo(() => {
    const byPerson = new Map<string, { collaboratorId: string; name: string; items: FollowUpItem[] }>();
    for (const item of shown) {
      const group = byPerson.get(item.collaboratorId) ?? { collaboratorId: item.collaboratorId, name: item.collaboratorName, items: [] };
      group.items.push(item);
      byPerson.set(item.collaboratorId, group);
    }
    return [...byPerson.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "pt-BR"));
  }, [shown]);

  const shownIds = useMemo(() => new Set(shown.map((i) => i.noteId)), [shown]);
  const selectedShown = [...selected].filter((id) => shownIds.has(id));
  const selectedItems = shown.filter((i) => selected.has(i.noteId));

  function toggle(ids: string[], value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function bulk(op: "warning" | "interview") {
    const ids = op === "warning" ? selectedItems.filter((i) => i.kind === "FALTA").map((i) => i.noteId) : selectedShown;
    startBulk(async () => {
      const res = await bulkFollowUpAction(ids, op);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(op === "warning" ? "Advertência marcada como aplicada." : "Entrevista de ABS marcada como feita.");
      setSelected(new Set());
      router.refresh();
    });
  }

  const tiles: { key: Filter; label: string; value: number; tone: string; ring: string }[] = [
    { key: "todas", label: "Pendências", value: items.length, tone: "text-foreground", ring: "border-accent" },
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar colaborador..."
            className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
          />
        </div>
        {shown.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground-muted">
            <input
              type="checkbox"
              checked={selectedShown.length === shown.length}
              onChange={(e) => toggle([...shownIds], e.target.checked)}
              className="size-4 cursor-pointer accent-[var(--accent)]"
            />
            Selecionar todos ({shown.length})
          </label>
        )}
      </div>

      {selectedShown.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface px-3 py-2 shadow-md">
          <span className="text-sm font-medium text-foreground">{selectedShown.length} selecionado(s)</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selectedItems.some((i) => i.kind === "FALTA") && (
              <Button size="sm" variant="secondary" loading={bulkPending} onClick={() => bulk("warning")}>
                Advertência aplicada
              </Button>
            )}
            {canHr && (
              <Button size="sm" variant="secondary" loading={bulkPending} onClick={() => bulk("interview")}>
                Entrevista feita
              </Button>
            )}
            <BulkDismissButton noteIds={selectedShown} onDone={() => setSelected(new Set())} />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          {items.length === 0 ? "Tudo em dia — nenhuma pendência." : "Ninguém encontrado com esse filtro."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const ids = group.items.map((i) => i.noteId);
            const allSelected = ids.every((id) => selected.has(id));
            return (
              <section key={group.collaboratorId} className="overflow-hidden rounded-lg border border-border bg-surface">
                <header className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    aria-label={`Selecionar todas as pendências de ${formatPersonName(group.name)}`}
                    className="size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                  />
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger-soft text-xs font-semibold text-danger">
                    {initials(group.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/colaboradores/${group.collaboratorId}`} className="text-sm font-semibold text-foreground hover:underline">
                      {formatPersonName(group.name)}
                    </Link>
                    <p className="text-xs text-foreground-subtle">{group.items.length} pendência(s)</p>
                  </div>
                </header>
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <FollowUpCard
                      key={item.noteId}
                      item={item}
                      selected={selected.has(item.noteId)}
                      onSelect={(value) => toggle([item.noteId], value)}
                      canHr={canHr}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
