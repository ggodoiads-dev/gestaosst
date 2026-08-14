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
import { setCollaboratorActiveAction } from "@/server/actions/collaborator.actions";

export function DeleteCollaboratorButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await setCollaboratorActiveAction(id, false);
      toast.success(`${name} excluído. O histórico dele continua disponível.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Excluir colaborador">
        <Trash2 className="size-4 text-danger" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {name}?</DialogTitle>
          <DialogDescription>
            O colaborador deixa de aparecer nas listas ativas. Acidentes, qualificações e o
            histórico já registrados para ele continuam disponíveis, e você pode reativá-lo
            depois se precisar.
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

export function ReactivateCollaboratorButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await setCollaboratorActiveAction(id, true);
      toast.success(`${name} reativado.`);
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleClick} loading={isPending} aria-label="Reativar colaborador">
      <RotateCcw className="size-4" />
    </Button>
  );
}
