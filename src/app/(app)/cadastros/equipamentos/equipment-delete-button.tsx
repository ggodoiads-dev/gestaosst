"use client";

import { useState, useTransition } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { setEquipmentActiveAction } from "@/server/actions/equipment.actions";

export function DeleteEquipmentButton({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await setEquipmentActiveAction(id, false);
      toast.success(`${code} excluído. O histórico dele continua disponível.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Excluir equipamento"
      >
        <Trash2 className="size-4 text-danger" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {code}?</DialogTitle>
          <DialogDescription>
            O equipamento deixa de aparecer nas listas e nos checklists do dia a dia. Checklists,
            não conformidades e o histórico já registrados para ele continuam disponíveis, e você
            pode reativá-lo depois se precisar.
          </DialogDescription>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="danger" onClick={handleConfirm} loading={isPending}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReactivateEquipmentButton({ id, code }: { id: string; code: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await setEquipmentActiveAction(id, true);
      toast.success(`${code} reativado.`);
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleClick} loading={isPending} aria-label="Reativar equipamento">
      <RotateCcw className="size-4" />
    </Button>
  );
}
