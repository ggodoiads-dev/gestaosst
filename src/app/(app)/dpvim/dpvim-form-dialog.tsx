"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDpvimAction, updateDpvimAction } from "@/server/actions/dpvim.actions";
import { DPVIM_DEADLINE_HOURS, parseBrasiliaLocal, type DpvimKindOption } from "@/domain/dpvim/rules";

const field = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

export type DpvimFormInitial = { id: string; kind: string; origin: string; reference: string; material: string; expectedQty: number; arrivedLocal: string; notes: string };

/** Cadastrar (ou editar) uma DPVIM: de onde veio, quando chegou, quantos itens, o que veio e o tipo (palete, chapatex ou quadro). O prazo de 48h conta da chegada. */
export function DpvimFormDialog({ initial, disabled, kinds }: { initial?: DpvimFormInitial; disabled?: boolean; kinds: DpvimKindOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(initial?.kind ?? "");
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [qty, setQty] = useState(initial ? String(initial.expectedQty) : "420");
  const [arrived, setArrived] = useState(initial?.arrivedLocal ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const arrivedDate = parseBrasiliaLocal(arrived);
  const dueLabel = arrivedDate
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(arrivedDate.getTime() + DPVIM_DEADLINE_HOURS * 3600 * 1000))
    : null;
  const qtyNum = Number(qty);
  const valid = !!kind && origin.trim().length >= 2 && Number.isInteger(qtyNum) && qtyNum > 0 && !!arrivedDate;

  function save() {
    if (!arrivedDate) return;
    setError(null);
    start(async () => {
      const input = { kind, origin, reference, material, expectedQty: qtyNum, arrivedAtIso: arrivedDate.toISOString(), notes };
      const res = initial ? await updateDpvimAction(initial.id, input) : await createDpvimAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(initial ? "DPVIM atualizada." : "DPVIM cadastrada. Já aparece para os ajudantes abrirem.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button size="sm" variant="secondary">
            <Pencil className="size-4" /> Editar
          </Button>
        ) : (
          <Button disabled={disabled}>
            <Plus className="size-4" /> Nova DPVIM
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar DPVIM" : "Nova DPVIM"}</DialogTitle>
          <DialogDescription>O prazo para rebater é de {DPVIM_DEADLINE_HOURS}h a partir da chegada. A quantidade é a que veio na nota; ao finalizar, a contagem é comparada com ela.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Tipo" required>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
                <option value="">Escolher…</option>
                {kinds
                  .filter((k) => k.active || k.key === initial?.kind)
                  .map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Quantos itens (na nota)" required hint="O valor que o conferente lançou">
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="tabular-nums" />
            </FormField>
          </div>
          <FormField label="De onde veio" required hint="Ex.: cervejaria, fábrica">
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} maxLength={120} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Quando chegou" required>
              <input type="datetime-local" value={arrived} onChange={(e) => setArrived(e.target.value)} className={field} />
            </FormField>
            <FormField label="Número / nota / placa" hint="Opcional">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
            </FormField>
          </div>
          {dueLabel && <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-foreground">Prazo para rebater: <strong>{dueLabel}</strong></p>}
          <FormField label="Materiais" hint="O que veio nessa carga (opcional)">
            <Input value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Observações" hint="Opcional">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending} disabled={!valid}>
            {initial ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
