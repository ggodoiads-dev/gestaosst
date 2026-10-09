"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";
import { formatPersonName, initials } from "@/lib/format-name";
import { DTO_JUSTIFICATION_REASON } from "@/domain/dto/suggestions";
import { justifyDtoAction, removeDtoJustificationAction } from "@/server/actions/dto.actions";
import type { DtoSuggestion } from "@/server/services/dto.service";

type View = "sugeridos" | "carencia";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function JustifyDialog({ item, todayKey }: { item: DtoSuggestion; todayKey: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dayKey, setDayKey] = useState(todayKey);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await justifyDtoAction({ collaboratorId: item.collaboratorId, dayKey, note: note || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Justificado. Ele sai das sugestões e só volta depois da carência.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Justificar
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Justificar {formatPersonName(item.name)}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-foreground">{DTO_JUSTIFICATION_REASON}</p>
          <p className="text-xs text-foreground-subtle">
            Conta como DTO feito na data abaixo: a pessoa deixa de ser sugerida e só volta depois de 60 dias.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Quando foi feito
            <input
              type="date"
              value={dayKey}
              max={todayKey}
              onChange={(e) => setDayKey(e.target.value)}
              className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Observação (opcional)
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: quem fez, em qual atividade"
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UndoButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await removeDtoJustificationAction(id);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          router.refresh();
        })
      }
    >
      Desfazer
    </Button>
  );
}

export function DtoSuggestions({
  items,
  cooldownDays,
  canJustify,
  todayKey,
}: {
  items: DtoSuggestion[];
  cooldownDays: number;
  canJustify: boolean;
  todayKey: string;
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [view, setView] = useState<View>("sugeridos");

  const eligible = items.filter((i) => i.eligible);
  const cooling = items.filter((i) => !i.eligible);
  const newHires = eligible.filter((i) => i.isNewHire).length;
  const never = eligible.filter((i) => i.daysSince === null && !i.isNewHire).length;
  const areas = useMemo(() => [...new Set(items.map((i) => i.areaName).filter((a): a is string => !!a))].sort(), [items]);

  const matches = (i: DtoSuggestion) =>
    (!query || normalize(i.name).includes(normalize(query))) && (!area || i.areaName === area);
  const shown = (view === "sugeridos" ? eligible : cooling).filter(matches);

  const tiles: { key: View; label: string; value: number; tone: string; ring: string }[] = [
    { key: "sugeridos", label: "Sugeridos para DTO", value: eligible.length, tone: "text-warning", ring: "border-warning" },
    { key: "carencia", label: `Em carência (< ${cooldownDays} dias)`, value: cooling.length, tone: "text-success", ring: "border-success" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setView(t.key)}
            aria-pressed={view === t.key}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-lg border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
              view === t.key ? cn("border-2", t.ring) : "border-border",
            )}
          >
            <span className={cn("text-2xl font-semibold tabular-nums leading-none", t.tone)}>{t.value}</span>
            <span className="text-xs text-foreground-subtle">
              {t.label}
              {t.key === "sugeridos" && newHires > 0 && ` · ${newHires} novo(s)`}
              {t.key === "sugeridos" && never > 0 && ` · ${never} nunca avaliado(s)`}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-foreground-subtle">
        Colaboradores ativos no SIGO. Os novos (menos de 60 dias de casa) vêm primeiro, depois quem nunca foi avaliado e quem está
        há mais tempo sem DTO. Quem foi avaliado só pode ser avaliado de novo depois de {cooldownDays} dias.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar colaborador..."
            className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
          />
        </div>
        {areas.length > 1 && (
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label="Filtrar por área"
            className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-foreground-subtle">
          {view === "sugeridos" ? "Ninguém para sugerir com esse filtro." : "Ninguém em carência com esse filtro."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {shown.map((i) => {
            const stale = i.daysSince === null || i.daysSince >= cooldownDays * 2;
            return (
              <div key={i.collaboratorId} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    view === "sugeridos" ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
                  )}
                >
                  {initials(i.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                    <span className="truncate">{formatPersonName(i.name)}</span>
                    {i.isNewHire && (
                      <span className="rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-semibold text-info">
                        Novo · {i.tenureDays} dia(s) de casa
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-foreground-subtle">
                    {[i.areaName, i.functionName && formatPersonName(i.functionName)].filter(Boolean).join(" · ") || "Sem área"}
                  </p>
                  {view === "sugeridos" ? (
                    <p className={cn("text-xs font-medium", stale ? "text-danger" : "text-warning")}>
                      {i.daysSince === null
                        ? "Nunca avaliado"
                        : `Último DTO há ${i.daysSince} dias (${formatDate(i.lastEffectiveDate!)}${i.justification ? " — justificado" : i.lastDtoActivity ? ` · ${i.lastDtoActivity}` : ""})`}
                    </p>
                  ) : (
                    <p className="text-xs text-foreground-subtle">
                      {i.justification
                        ? `Justificado em ${formatDate(i.justification.date)}${i.justification.note ? ` — ${i.justification.note}` : ""}`
                        : `Último DTO em ${formatDate(i.lastDtoDate!)}${i.lastDtoActivity ? ` · ${i.lastDtoActivity}` : ""}`}
                      {i.eligibleOn && ` · libera em ${formatDate(i.eligibleOn)}`}
                    </p>
                  )}
                </div>
                {canJustify && view === "sugeridos" && <JustifyDialog item={i} todayKey={todayKey} />}
                {canJustify && view === "carencia" && i.justification && <UndoButton id={i.justification.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
