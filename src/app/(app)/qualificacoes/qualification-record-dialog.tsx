"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
  createQualificationRecordAction,
  updateQualificationRecordAction,
  deleteQualificationRecordAction,
  type ActionResult,
} from "@/server/actions/qualification.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Collaborator, QualificationType } from "@/generated/prisma/client";

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

export function EditQualificationRecordDialog({
  record,
  collaborators,
  types,
  trigger,
}: {
  record: { id: string; collaboratorId: string; qualificationTypeId: string; completedDate: Date; notes: string | null };
  collaborators: Collaborator[];
  types: QualificationType[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateQualificationRecordAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [collaboratorId, setCollaboratorId] = useState(record.collaboratorId);
  const [qualificationTypeId, setQualificationTypeId] = useState(record.qualificationTypeId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteQualificationRecordAction(record.id, record.collaboratorId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Qualificação excluída.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar qualificação</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={record.id} />
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
            <FormField label="Data de conclusão" htmlFor="edit-completedDate" required>
              <Input id="edit-completedDate" name="completedDate" type="date" required defaultValue={toDateInputValue(record.completedDate)} />
            </FormField>
            <FormField label="Observações" htmlFor="edit-notes" hint="Opcional">
              <Textarea id="edit-notes" name="notes" rows={2} defaultValue={record.notes ?? ""} />
            </FormField>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}

            {confirmingDelete && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5">
                <p className="text-sm text-danger">Excluir esta qualificação de vez? Não pode ser desfeito.</p>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" size="sm" variant="danger" loading={deleting} onClick={handleDelete}>
                    Sim, excluir
                  </Button>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" loading={pending}>Salvar</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
