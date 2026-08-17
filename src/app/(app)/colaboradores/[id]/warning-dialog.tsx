"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertOctagon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { createWarningAction, deleteWarningAction, type ActionResult } from "@/server/actions/warning.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";

const initialState: ActionResult = { ok: true };

export function CreateWarningDialog({ collaboratorId }: { collaboratorId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createWarningAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <AlertOctagon /> Registrar advertência
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar advertência</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Data" htmlFor="date" required>
              <Input id="date" name="date" type="date" required />
            </FormField>
            <FormField label="Motivo" htmlFor="reason" required>
              <Textarea id="reason" name="reason" rows={3} required />
            </FormField>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteWarningButton({ id, collaboratorId }: { id: string; collaboratorId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      loading={pending}
      aria-label="Remover advertência"
      onClick={() =>
        startTransition(async () => {
          await deleteWarningAction(id, collaboratorId);
          toast.success("Advertência removida.");
        })
      }
    >
      <Trash2 className="size-4 text-danger" />
    </Button>
  );
}
