"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName, initials } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { applyMeasureAction, dismissOccurrenceAction } from "@/server/actions/discipline.actions";
import { stepHasDocument } from "@/domain/discipline/document";
import {
  DISCIPLINE_STEPS,
  disciplineReasonLabel,
  disciplineStepLabel,
  type DisciplineReasonKey,
  type DisciplineStepKey,
} from "@/domain/discipline/ladder";

export type DisciplineEntry = {
  reason: DisciplineReasonKey;
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  suggestedStep: DisciplineStepKey;
  appliedCount: number;
  done?: number;
  required?: number;
};

export type DisciplineHistoryRow = {
  id: string;
  reason: DisciplineReasonKey;
  collaboratorName: string;
  dayKey: string;
  step: string;
  status: "APLICADA" | "DISPENSADA";
  hasDocument: boolean;
  note: string | null;
  decidedByName: string;
  decidedAtLabel: string;
};

function dmy(dayKey: string) {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
}

/** Aplicar a medida (padrão: a próxima da escada) ou dispensar com justificativa. */
export function MeasureDialog({ entry, mode, trigger }: { entry: DisciplineEntry; mode: "apply" | "dismiss"; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DisciplineStepKey>(entry.suggestedStep);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isApply = mode === "apply";

  function save() {
    setError(null);
    startTransition(async () => {
      const input = { reason: entry.reason, collaboratorId: entry.collaboratorId, dayKey: entry.dayKey, step, note };
      const res = isApply ? await applyMeasureAction(input) : await dismissOccurrenceAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const withDocument = isApply && res.id && stepHasDocument(step);
      toast.success(
        isApply ? `${disciplineStepLabel(step)} registrada.${withDocument ? " O documento para imprimir está sendo baixado." : ""}` : "Ocorrência dispensada.",
      );
      if (withDocument) window.location.assign(`/api/medidas-disciplinares/${res.id}/docx`);
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isApply ? "Registrar medida disciplinar" : "Dispensar ocorrência"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{formatPersonName(entry.collaboratorName)}</p>
            <p className="text-xs text-foreground-subtle">
              {disciplineReasonLabel(entry.reason)} · {dmy(entry.dayKey)} · {entry.appliedCount} medida(s) já aplicada(s) por esse motivo
            </p>
          </div>
          {isApply ? (
            <FormField label="Medida" hint="Sugerida pela escada deste motivo — pode trocar se precisar">
              <Select value={step} onValueChange={(v) => setStep(v as DisciplineStepKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCIPLINE_STEPS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      {s.key === entry.suggestedStep ? " (sugerida)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <p className="text-foreground-subtle">Não gera medida e não avança a escada. O motivo fica registrado.</p>
          )}
          <FormField label={isApply ? "Observação" : "Motivo da justificativa"} required={!isApply} hint={isApply ? "Opcional" : undefined}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>{isApply ? "Registrar" : "Dispensar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Checklist não realizado (nenhum equipamento feito no dia) → medida sugerida pela escada do checklist. */
export function DisciplineSection({ items, partial, history }: { items: DisciplineEntry[]; partial: DisciplineEntry[]; history: DisciplineHistoryRow[] }) {
  const [showHistory, setShowHistory] = useState(false);
  const checklist = items.filter((i) => i.reason === "CHECKLIST");
  const groups = new Map<string, { name: string; id: string; items: DisciplineEntry[] }>();
  for (const i of checklist) {
    const g = groups.get(i.collaboratorId) ?? { name: i.collaboratorName, id: i.collaboratorId, items: [] };
    g.items.push(i);
    groups.set(i.collaboratorId, g);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gavel className="size-4" /> Checklist não realizado ({checklist.length})
          </h2>
          <p className="text-xs text-foreground-subtle">
            Só entra quem não fez nenhum equipamento do checklist no dia (fez a maioria = cumpriu). Cada motivo segue a sua escada: 1º DTO →
            2º DTO → advertência verbal → 1ª escrita → 2ª escrita → suspensão de 1 dia → suspensão de 3 dias → comitê.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
          <History className="size-4" /> {showHistory ? "Ocultar histórico" : "Histórico de medidas"}
        </Button>
      </div>

      {checklist.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-foreground-subtle">
          Nenhuma ocorrência de checklist pendente.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...groups.values()].map((g) => (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-soft text-xs font-semibold text-danger">{initials(g.name)}</span>
                <Link href={`/colaboradores/${g.id}`} className="text-sm font-semibold text-foreground hover:underline">
                  {formatPersonName(g.name)}
                </Link>
                <span className="text-xs text-foreground-subtle">{g.items.length} dia(s) sem checklist</span>
              </div>
              <div className="divide-y divide-border">
                {g.items.map((item) => (
                  <div key={item.dayKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{dmy(item.dayKey)} — não fez nenhum equipamento</p>
                      <p className="text-xs text-warning">Medida sugerida: {disciplineStepLabel(item.suggestedStep)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <MeasureDialog entry={item} mode="apply" trigger={<Button size="sm">Registrar medida</Button>} />
                      <MeasureDialog entry={item} mode="dismiss" trigger={<Button size="sm" variant="secondary">Dispensar</Button>} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {partial.length > 0 && (
        <details className="rounded-lg border border-border bg-surface px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
            Fizeram só uma parte do checklist ({partial.length}) — não geram medida sozinhos, mas você pode aplicar
          </summary>
          <div className="mt-2 divide-y divide-border">
            {partial.map((item) => (
              <div key={`${item.collaboratorId}|${item.dayKey}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <Link href={`/colaboradores/${item.collaboratorId}`} className="font-medium hover:underline">
                      {formatPersonName(item.collaboratorName)}
                    </Link>{" "}
                    · {dmy(item.dayKey)} · fez {item.done} de {item.required} equipamentos
                  </p>
                  <p className="text-xs text-foreground-subtle">Se aplicar, a medida sugerida é: {disciplineStepLabel(item.suggestedStep)}</p>
                </div>
                <div className="flex gap-1.5">
                  <MeasureDialog entry={item} mode="apply" trigger={<Button size="sm" variant="secondary">Registrar medida</Button>} />
                  <MeasureDialog entry={item} mode="dismiss" trigger={<Button size="sm" variant="ghost">Dispensar</Button>} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {showHistory && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-foreground-subtle">Nenhuma medida registrada ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-xs">
                  <span className="text-foreground">
                    <strong>{formatPersonName(h.collaboratorName)}</strong> · {disciplineReasonLabel(h.reason)} ({dmy(h.dayKey)}) ·{" "}
                    <span className={cn(h.status === "APLICADA" ? "text-danger" : "text-foreground-subtle")}>
                      {h.status === "APLICADA" ? disciplineStepLabel(h.step) : "Dispensada"}
                    </span>
                    {h.note && <span className="text-foreground-subtle"> — “{h.note}”</span>}
                    {h.hasDocument && (
                      <a href={`/api/medidas-disciplinares/${h.id}/docx`} className="ml-2 text-accent hover:underline">
                        Documento (Word)
                      </a>
                    )}
                  </span>
                  <span className="text-foreground-subtle">
                    {h.decidedByName} · {h.decidedAtLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
