"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
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
import { createQualificationRecordAction, type ActionResult } from "@/server/actions/qualification.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Collaborator, QualificationType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateQualificationRecordDialog({
  collaborators,
  types,
  defaultCollaboratorId,
}: {
  collaborators: Collaborator[];
  types: QualificationType[];
  defaultCollaboratorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createQualificationRecordAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [collaboratorId, setCollaboratorId] = useState(defaultCollaboratorId ?? collaborators[0]?.id ?? "");
  const [qualificationTypeId, setQualificationTypeId] = useState(types[0]?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Registrar qualificação
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar qualificação</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="qualificationTypeId" value={qualificationTypeId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Colaborador" required>
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tipo de qualificação" required>
              <Select value={qualificationTypeId} onValueChange={setQualificationTypeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Data de conclusão" htmlFor="completedDate" required>
              <Input id="completedDate" name="completedDate" type="date" required />
            </FormField>
            <FormField label="Observações" htmlFor="notes" hint="Opcional">
              <Textarea id="notes" name="notes" rows={2} />
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
