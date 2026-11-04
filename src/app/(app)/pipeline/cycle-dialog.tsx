"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ICC_RESULTS } from "@/domain/pipeline/rules";
import { deleteCycleEntryAction, saveCycleEntryAction, saveRiskFollowAction } from "@/server/actions/pipeline.actions";
import type { CycleRow } from "@/server/services/pipeline.service";

type Form = { name: string; leader: string; cycleType: string; icc: string; iccResult: string; ir: string; irResult: string; selfEval: string; perfEval: string; finalClass: string };
const blank: Form = { name: "", leader: "", cycleType: "", icc: "", iccResult: "NAO_INFORMADO", ir: "", irResult: "", selfEval: "", perfEval: "", finalClass: "" };
const fromRow = (c: CycleRow): Form => ({ name: c.name, leader: c.leader ?? "", cycleType: c.cycleType ?? "", icc: c.icc === null ? "" : String(c.icc), iccResult: c.iccResult ?? "NAO_INFORMADO", ir: c.ir === null ? "" : String(c.ir), irResult: c.irResult ?? "", selfEval: c.selfEval ?? "", perfEval: c.perfEval ?? "", finalClass: c.finalClass ?? "" });

/** Resultado do Ciclo de Gente de uma pessoa no ano. */
export function CycleDialog({ year, entry, names }: { year: number; entry?: CycleRow; names: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(entry ? fromRow(entry) : blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const listId = `cycle-names-${entry?.id ?? "novo"}`;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveCycleEntryAction(entry?.id ?? null, { cycleYear: year, ...form });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Resultado salvo.");
      setOpen(false);
      if (!entry) setForm(blank);
      router.refresh();
    });
  }

  function remove() {
    if (!entry) return;
    startTransition(async () => {
      const res = await deleteCycleEntryAction(entry.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Registro removido.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {entry ? (
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={`Editar ${entry.name}`}>
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Lançar resultado
        </Button>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{entry ? `Ciclo de Gente ${year} — ${entry.name}` : `Ciclo de Gente ${year}`}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <datalist id={listId}>
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Colaborador" required>
              <Input list={listId} value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={160} />
            </FormField>
            <FormField label="Líder">
              <Input list={listId} value={form.leader} onChange={(e) => set({ leader: e.target.value })} maxLength={160} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Tipo de ciclo">
              <Input value={form.cycleType} onChange={(e) => set({ cycleType: e.target.value })} maxLength={80} />
            </FormField>
            <FormField label="ICC (nota)">
              <Input inputMode="decimal" value={form.icc} onChange={(e) => set({ icc: e.target.value })} />
            </FormField>
            <FormField label="Resultado do ICC">
              <Select value={form.iccResult} onValueChange={(v) => set({ iccResult: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICC_RESULTS.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="IR (nota)">
              <Input inputMode="decimal" value={form.ir} onChange={(e) => set({ ir: e.target.value })} />
            </FormField>
            <FormField label="Resultado do IR">
              <Input value={form.irResult} onChange={(e) => set({ irResult: e.target.value })} maxLength={80} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Autoavaliação">
              <Input value={form.selfEval} onChange={(e) => set({ selfEval: e.target.value })} maxLength={80} />
            </FormField>
            <FormField label="Avaliação de desempenho (AVD)">
              <Input value={form.perfEval} onChange={(e) => set({ perfEval: e.target.value })} maxLength={80} />
            </FormField>
            <FormField label="Classificação final">
              <Input value={form.finalClass} onChange={(e) => set({ finalClass: e.target.value })} maxLength={80} />
            </FormField>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter className="justify-between">
          {entry ? (
            <Button variant="ghost" onClick={remove} loading={pending}>
              <Trash2 className="size-4" /> Remover
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

/** Situação atual e follow de quem está na lista de risco de turnover. */
export function RiskFollowEditor({ entry }: { entry: CycleRow }) {
  const router = useRouter();
  const [situation, setSituation] = useState(entry.situation ?? "");
  const [follow, setFollow] = useState(entry.follow ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = situation !== (entry.situation ?? "") || follow !== (entry.follow ?? "");

  function save() {
    startTransition(async () => {
      const res = await saveRiskFollowAction(entry.id, { situation, follow });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Follow salvo.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
      <Input value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="Situação atual" maxLength={300} className="h-8" />
      <Input value={follow} onChange={(e) => setFollow(e.target.value)} placeholder="Follow (o que foi combinado)" maxLength={300} className="h-8" />
      <Button size="sm" variant="secondary" onClick={save} loading={pending} disabled={!dirty}>
        Salvar
      </Button>
    </div>
  );
}
