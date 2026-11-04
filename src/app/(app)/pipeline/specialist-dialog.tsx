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
import { SPECIALIST_GROUPS } from "@/domain/pipeline/matrix";
import { POSITION_STATUS } from "@/domain/pipeline/rules";
import { deleteSpecialistAction, saveSpecialistAction } from "@/server/actions/pipeline-matrix.actions";
import type { SpecialistRow } from "@/server/services/pipeline-matrix.service";

const NONE = "none";
type Form = { name: string; functionName: string; grp: string; skill: string; action: string; dueDate: string; dueNote: string; follow: string; status: string };
const blank: Form = { name: "", functionName: "", grp: SPECIALIST_GROUPS[0], skill: "", action: "", dueDate: "", dueNote: "", follow: "", status: NONE };
const fromRow = (r: SpecialistRow): Form => ({ name: r.name, functionName: r.functionName ?? "", grp: r.grp, skill: r.skill ?? "", action: r.action ?? "", dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "", dueNote: r.dueNote ?? "", follow: r.follow ?? "", status: r.status ?? NONE });

/** Plano de desenvolvimento de um especialista de função. `people` = colaboradores ativos, só de sugestão. */
export function SpecialistDialog({ row, people, defaultGroup }: { row?: SpecialistRow; people: { name: string; functionName: string | null }[]; defaultGroup?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(row ? fromRow(row) : { ...blank, grp: defaultGroup ?? blank.grp });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const listId = `esp-names-${row?.id ?? "novo"}-${defaultGroup ?? ""}`;
  const orNull = (v: string) => (v === NONE || v.trim() === "" ? null : v.trim());

  function onName(value: string) {
    const known = people.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    set({ name: value, ...(known && !form.functionName ? { functionName: known.functionName ?? "" } : {}) });
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveSpecialistAction(row?.id ?? null, {
        name: form.name,
        functionName: orNull(form.functionName),
        grp: form.grp,
        skill: orNull(form.skill),
        action: orNull(form.action),
        dueDate: orNull(form.dueDate),
        dueNote: orNull(form.dueNote),
        follow: orNull(form.follow),
        status: orNull(form.status),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Especialista salvo.");
      setOpen(false);
      if (!row) setForm({ ...blank, grp: defaultGroup ?? blank.grp });
      router.refresh();
    });
  }

  function remove() {
    if (!row) return;
    start(async () => {
      const res = await deleteSpecialistAction(row.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Removido.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {row ? (
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={`Editar ${row.name}`}>
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button variant={defaultGroup ? "ghost" : "primary"} size={defaultGroup ? "sm" : "md"} onClick={() => setOpen(true)}>
          <Plus className="size-4" /> {defaultGroup ? "Adicionar" : "Novo especialista"}
        </Button>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? `Editar — ${row.name}` : "Novo especialista de função"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <datalist id={listId}>
            {people.map((p) => (
              <option key={p.name} value={p.name} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Nome" required>
              <Input list={listId} value={form.name} onChange={(e) => onName(e.target.value)} maxLength={160} />
            </FormField>
            <FormField label="Função">
              <Input value={form.functionName} onChange={(e) => set({ functionName: e.target.value })} maxLength={120} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Grupo" required>
              <Select value={form.grp} onValueChange={(v) => set({ grp: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALIST_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Habilidade a desenvolver">
              <Input value={form.skill} onChange={(e) => set({ skill: e.target.value })} maxLength={160} />
            </FormField>
          </div>
          <FormField label="Ação">
            <Textarea rows={2} value={form.action} onChange={(e) => set({ action: e.target.value })} maxLength={600} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Data">
              <Input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
            </FormField>
            <FormField label="Data (texto livre)">
              <Input value={form.dueNote} onChange={(e) => set({ dueNote: e.target.value })} maxLength={120} placeholder="Ex.: dezembro" />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem status</SelectItem>
                  {POSITION_STATUS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Follow (o que foi combinado)">
            <Textarea rows={2} value={form.follow} onChange={(e) => set({ follow: e.target.value })} maxLength={300} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter className="justify-between">
          {row ? (
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
