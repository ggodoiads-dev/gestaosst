"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
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
  createEquipmentTypeAction,
  updateEquipmentTypeAction,
  type ActionResult,
} from "@/server/actions/masterdata.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { EquipmentType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateEquipmentTypeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEquipmentTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo tipo
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tipo de equipamento</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="Ex: Paleteira Elétrica" />
            </FormField>
            <FormField label="Código" htmlFor="code" required hint="Identificador único, ex: TE-PE">
              <Input id="code" name="code" required placeholder="TE-PE" />
            </FormField>
            <FormField label="Descrição" htmlFor="description">
              <Textarea id="description" name="description" rows={2} />
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

export function EditEquipmentTypeDialog({ type }: { type: EquipmentType }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateEquipmentTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar tipo">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tipo de equipamento</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={type.id} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="edit-type-name" required>
              <Input id="edit-type-name" name="name" required defaultValue={type.name} />
            </FormField>
            <FormField label="Código" htmlFor="edit-type-code" required>
              <Input id="edit-type-code" name="code" required defaultValue={type.code} />
            </FormField>
            <FormField label="Descrição" htmlFor="edit-type-description">
              <Textarea id="edit-type-description" name="description" rows={2} defaultValue={type.description ?? ""} />
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
