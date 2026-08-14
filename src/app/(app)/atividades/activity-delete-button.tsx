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
import { setActivityActiveAction } from "@/server/actions/activity.actions";

export function DeleteActivityButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await setActivityActiveAction(id, false);
      toast.success(`${name} excluída. Os documentos continuam disponíveis.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Excluir atividade">
        <Trash2 className="size-4 text-danger" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {name}?</DialogTitle>
          <DialogDescription>
            A atividade deixa de aparecer na lista ativa. O POP, o AR/VR e o histórico de versões
            continuam disponíveis, e você pode reativá-la depois se precisar.
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

export function ReactivateActivityButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await setActivityActiveAction(id, true);
      toast.success(`${name} reativada.`);
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleClick} loading={isPending} aria-label="Reativar atividade">
      <RotateCcw className="size-4" />
    </Button>
  );
}
