"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { setJobFunctionKitAction } from "@/server/actions/epi.actions";
import type { EpiType } from "@/generated/prisma/client";

type KitItem = { epiTypeId: string; quantity: number };

export function EditJobFunctionKitDialog({
  jobFunction,
  epiTypes,
  currentKit,
}: {
  jobFunction: { id: string; name: string };
  epiTypes: EpiType[];
  currentKit: KitItem[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, number>>(
    () => new Map(currentKit.map((i) => [i.epiTypeId, i.quantity])),
  );
  const [isPending, startTransition] = useTransition();

  function toggle(epiTypeId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(epiTypeId, next.get(epiTypeId) ?? 1);
      else next.delete(epiTypeId);
      return next;
    });
  }

  function setQuantity(epiTypeId: string, quantity: number) {
    setSelected((prev) => {
      if (!prev.has(epiTypeId)) return prev;
      const next = new Map(prev);
      next.set(epiTypeId, quantity);
      return next;
    });
  }

  function handleSave() {
    const items: KitItem[] = Array.from(selected, ([epiTypeId, quantity]) => ({ epiTypeId, quantity }));
    startTransition(async () => {
      const result = await setJobFunctionKitAction(jobFunction.id, items);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Kit de EPI de ${jobFunction.name} atualizado.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Editar kit de EPI
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kit de EPI — {jobFunction.name}</DialogTitle>
          <DialogDescription>
            Os itens marcados aqui são lançados automaticamente na ficha de EPI de todo
            colaborador cadastrado (ou editado) com esta função.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {epiTypes.length === 0 && (
            <p className="text-sm text-foreground-subtle">Nenhum tipo de EPI ativo cadastrado ainda.</p>
          )}
          {epiTypes.map((type) => {
            const checked = selected.has(type.id);
            return (
              <div key={type.id} className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`kit-${jobFunction.id}-${type.id}`}
                  checked={checked}
                  onCheckedChange={(value) => toggle(type.id, value === true)}
                />
                <label htmlFor={`kit-${jobFunction.id}-${type.id}`} className="flex-1 text-sm">
                  {type.name}
                </label>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  disabled={!checked}
                  value={selected.get(type.id) ?? 1}
                  onChange={(e) => setQuantity(type.id, Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            );
          })}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} loading={isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
