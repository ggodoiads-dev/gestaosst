"use client";

import { useState, useTransition } from "react";
import { UserX, UserCheck } from "lucide-react";
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
      toast.success(`${name} desligado. O histórico dele continua disponível.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Desligar colaborador">
        <UserX className="size-4 text-danger" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desligar {name}?</DialogTitle>
          <DialogDescription>
            O colaborador deixa de aparecer nas listas ativas, relatórios, áreas e no QR code
            público dele. Acidentes, qualificações e o histórico já registrados continuam
            disponíveis, e você pode recontratá-lo depois se precisar.
          </DialogDescription>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="danger" onClick={handleConfirm} loading={isPending}>
            Desligar
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
      toast.success(`${name} recontratado.`);
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleClick} loading={isPending} aria-label="Recontratar colaborador">
      <UserCheck className="size-4" />
    </Button>
  );
}
