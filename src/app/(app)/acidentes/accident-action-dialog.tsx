"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  createAccidentActionItemAction,
  completeAccidentActionItemAction,
  type ActionResult,
} from "@/server/actions/accident.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Collaborator } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateAccidentActionDialog({
  accidentId,
  collaborators,
}: {
  accidentId: string;
  collaborators: Collaborator[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAccidentActionItemAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [responsibleCollaboratorId, setResponsibleCollaboratorId] = useState(collaborators[0]?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus /> Nova ação corretiva
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ação corretiva</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="accidentId" value={accidentId} />
          <input type="hidden" name="responsibleCollaboratorId" value={responsibleCollaboratorId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Descrição" htmlFor="description" required>
              <Textarea id="description" name="description" rows={2} required />
            </FormField>
            <FormField label="Responsável" required>
              <Select value={responsibleCollaboratorId} onValueChange={setResponsibleCollaboratorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Prazo" htmlFor="dueDate" required>
              <Input id="dueDate" name="dueDate" type="date" required />
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

export function CompleteAccidentActionButton({ actionId, accidentId }: { actionId: string; accidentId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await completeAccidentActionItemAction(actionId, accidentId);
      toast.success("Ação concluída.");
    });
  }

  return (
    <Button size="sm" variant="secondary" loading={isPending} onClick={handleClick}>
      <Check className="size-4" /> Concluir
    </Button>
  );
}
