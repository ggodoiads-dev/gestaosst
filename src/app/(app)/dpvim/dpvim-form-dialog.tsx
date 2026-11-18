"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDpvimAction, updateDpvimAction } from "@/server/actions/dpvim.actions";
import { DPVIM_DEADLINE_HOURS, parseBrasiliaLocal, type DpvimKindOption } from "@/domain/dpvim/rules";

const field = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

export type DpvimFormInitial = { id: string; origin: string; reference: string; material: string; items: { kind: string; qty: number }[]; arrivedLocal: string; notes: string };

type Row = { kind: string; qty: string };

/**
 * Cadastrar (ou editar) uma DPVIM: de onde veio, quando chegou e o que veio, produto a produto (ex.: 120 paletes + 200 chapatex + 400 quadros).
 * As quantidades são a contagem do conferente, só um norte. O prazo de 48h conta da chegada.
 */
export function DpvimFormDialog({ initial, disabled, kinds }: { initial?: DpvimFormInitial; disabled?: boolean; kinds: DpvimKindOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(initial && initial.items.length > 0 ? initial.items.map((i) => ({ kind: i.kind, qty: String(i.qty) })) : [{ kind: "", qty: "" }]);
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [arrived, setArrived] = useState(initial?.arrivedLocal ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const arrivedDate = parseBrasiliaLocal(arrived);
  const dueLabel = arrivedDate
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(arrivedDate.getTime() + DPVIM_DEADLINE_HOURS * 3600 * 1000))
    : null;

  const initialKinds = initial?.items.map((i) => i.kind) ?? [];
  const options = kinds.filter((k) => k.active || initialKinds.includes(k.key));
  const chosen = rows.map((r) => r.kind).filter(Boolean);
  const rowOk = (r: Row) => !!r.kind && Number.isInteger(Number(r.qty)) && Number(r.qty) > 0 && r.qty.trim() !== "";
  const total = rows.reduce((s, r) => s + (rowOk(r) ? Number(r.qty) : 0), 0);
  const valid = rows.length > 0 && rows.every(rowOk) && new Set(chosen).size === chosen.length && origin.trim().length >= 2 && !!arrivedDate;

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function save() {
    if (!arrivedDate) return;
    setError(null);
    start(async () => {
      const input = { origin, reference, material, items: rows.map((r) => ({ kind: r.kind, qty: Number(r.qty) })), arrivedAtIso: arrivedDate.toISOString(), notes };
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar DPVIM" : "Nova DPVIM"}</DialogTitle>
          <DialogDescription>O prazo para rebater é de {DPVIM_DEADLINE_HOURS}h a partir da chegada. A quantidade da nota é lançada à parte, por quem tem acesso a ela.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="O que veio" required hint="Um produto por linha. A sua contagem é só um norte: quem confere o total são os ajudantes, contra a nota.">
            <div className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_2.25rem] items-center gap-2">
                  <select value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value })} className={field} aria-label={`Tipo do produto ${i + 1}`}>
                    <option value="">Escolher o tipo…</option>
                    {options.map((k) => (
                      <option key={k.key} value={k.key} disabled={chosen.includes(k.key) && r.kind !== k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <Input value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} inputMode="numeric" placeholder="Qtd." className="tabular-nums" aria-label={`Quantidade do produto ${i + 1}`} />
                  <Button type="button" size="icon" variant="ghost" disabled={rows.length === 1} onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Tirar este produto">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={rows.length >= options.length} onClick={() => setRows((prev) => [...prev, { kind: "", qty: "" }])}>
                  <Plus className="size-4" /> Adicionar outro produto
                </Button>
                <span className="text-xs tabular-nums text-foreground-subtle">Total do norte: {total}</span>
              </div>
            </div>
          </FormField>
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
