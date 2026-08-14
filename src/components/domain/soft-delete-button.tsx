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

/** Botão de excluir com popup de confirmação, pra registros de cadastro (áreas, unidades,
 * tipos de qualificação, tipos de escala, ...) onde "excluir" é sempre soft-delete
 * (`active = false`) — nunca apaga o registro do banco, pra não quebrar referências
 * históricas (equipamentos, colaboradores, execuções já vinculados a ele). */
type ConfirmResult = { ok: true } | { ok: false; error: string } | void;

export function SoftDeleteButton({
  title,
  description,
  onConfirm,
  successMessage,
  ariaLabel = "Excluir",
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<ConfirmResult>;
  successMessage: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={ariaLabel}>
        <Trash2 className="size-4 text-danger" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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

export function ReactivateButton({
  onConfirm,
  successMessage,
  ariaLabel = "Reativar",
}: {
  onConfirm: () => Promise<ConfirmResult>;
  successMessage: string;
  ariaLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
    });
  }

  return (
    <Button size="icon" variant="ghost" onClick={handleClick} loading={isPending} aria-label={ariaLabel}>
      <RotateCcw className="size-4" />
    </Button>
  );
}
