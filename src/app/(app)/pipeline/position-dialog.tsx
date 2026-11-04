"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CRITICALITY, GAPS, ORIGIN, POSITION_STATUS, POTENTIAL, READINESS } from "@/domain/pipeline/rules";
import { deletePositionAction, savePositionAction } from "@/server/actions/pipeline.actions";
import type { PositionRow } from "@/server/services/pipeline.service";

const NONE = "none";

type Form = {
  cargo: string;
  area: string;
  criticality: string;
  occupant: string;
  successor1: string;
  successor2: string;
  origin: string;
  readiness: string;
  potential: string;
  gap: string;
  action: string;
  dueDate: string;
  dueNote: string;
  status: string;
};

const blank: Form = { cargo: "", area: "", criticality: "MEDIA", occupant: "", successor1: "", successor2: "", origin: NONE, readiness: NONE, potential: NONE, gap: NONE, action: "", dueDate: "", dueNote: "", status: NONE };

const fromRow = (p: PositionRow): Form => ({
  cargo: p.cargo,
  area: p.area ?? "",
  criticality: p.criticality,
  occupant: p.occupant ?? "",
  successor1: p.successor1 ?? "",
  successor2: p.successor2 ?? "",
  origin: p.origin ?? NONE,
  readiness: p.readiness ?? NONE,
  potential: p.potential ?? NONE,
  gap: p.gap ?? NONE,
  action: p.action ?? "",
  dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : "",
  dueNote: p.dueNote ?? "",
  status: p.status ?? NONE,
});

function Choice({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly { key: string; label: string }[]; placeholder?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {placeholder && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Cadastro e edição de um cargo do plano de sucessão. `names` = colaboradores ativos, só como sugestão nos campos de nome. */
export function PositionDialog({ position, names }: { position?: PositionRow; names: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(position ? fromRow(position) : blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const listId = `names-${position?.id ?? "novo"}`;
  const orNull = (v: string) => (v === NONE || v.trim() === "" ? null : v.trim());

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePositionAction(position?.id ?? null, {
        cargo: form.cargo,
        area: orNull(form.area),
        criticality: form.criticality,
        occupant: orNull(form.occupant),
        successor1: orNull(form.successor1),
        successor2: orNull(form.successor2),
        origin: orNull(form.origin),
        readiness: orNull(form.readiness),
        potential: orNull(form.potential),
        gap: orNull(form.gap),
        action: orNull(form.action),
        dueDate: orNull(form.dueDate),
        dueNote: orNull(form.dueNote),
        status: orNull(form.status),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Cargo salvo.");
      setOpen(false);
      if (!position) setForm(blank);
      router.refresh();
    });
  }

  function remove() {
    if (!position) return;
    startTransition(async () => {
      const res = await deletePositionAction(position.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cargo removido do plano.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {position ? (
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={`Editar ${position.cargo}`}>
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo cargo
        </Button>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{position ? `Editar — ${position.cargo}` : "Novo cargo no plano de sucessão"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <datalist id={listId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Cargo" required>
              <Input value={form.cargo} onChange={(e) => set({ cargo: e.target.value })} maxLength={160} />
            </FormField>
            <FormField label="Área">
              <Input value={form.area} onChange={(e) => set({ area: e.target.value })} maxLength={120} />
            </FormField>
            <FormField label="Criticidade do cargo">
              <Choice value={form.criticality} onChange={(v) => set({ criticality: v })} options={CRITICALITY} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Ocupante atual">
              <Input list={listId} value={form.occupant} onChange={(e) => set({ occupant: e.target.value })} maxLength={160} />
            </FormField>
            <FormField label="Sucessor 1ª">
              <Input list={listId} value={form.successor1} onChange={(e) => set({ successor1: e.target.value })} maxLength={160} />
            </FormField>
            <FormField label="Sucessor 2ª">
              <Input list={listId} value={form.successor2} onChange={(e) => set({ successor2: e.target.value })} maxLength={160} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Origem do sucessor">
              <Choice value={form.origin} onChange={(v) => set({ origin: v })} options={ORIGIN} placeholder="Não informado" />
            </FormField>
            <FormField label="Prontidão">
              <Choice value={form.readiness} onChange={(v) => set({ readiness: v })} options={READINESS} placeholder="Sem sucessor pronto" />
            </FormField>
            <FormField label="Potencial do sucessor">
              <Choice value={form.potential} onChange={(v) => set({ potential: v })} options={POTENTIAL} placeholder="Não avaliado" />
            </FormField>
          </div>
          <FormField label="Gap do sucessor (o que falta desenvolver)">
            <Choice value={form.gap} onChange={(v) => set({ gap: v })} options={GAPS.map((g) => ({ key: g, label: g }))} placeholder="Sem gap definido" />
          </FormField>
          <FormField label="Ação para fechar o gap">
            <Textarea rows={2} value={form.action} onChange={(e) => set({ action: e.target.value })} maxLength={600} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Prazo">
              <Input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </FormField>
            <FormField label="Prazo (texto livre)">
              <Input value={form.dueNote} onChange={(e) => set({ dueNote: e.target.value })} maxLength={120} placeholder="Ex.: março" />
            </FormField>
            <FormField label="Status da ação">
              <Choice value={form.status} onChange={(v) => set({ status: v })} options={POSITION_STATUS} placeholder="Sem status" />
            </FormField>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter className="justify-between">
          {position ? (
            <Button variant="ghost" onClick={remove} loading={pending}>
              <Trash2 className="size-4" /> Remover cargo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={save} loading={pending}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
