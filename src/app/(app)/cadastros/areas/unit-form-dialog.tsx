"use client";

import { useActionState, useState } from "react";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createUnitAction, updateUnitAction, type ActionResult } from "@/server/actions/masterdata.actions";
import type { Unit } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateUnitDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUnitAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nova unidade
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova unidade</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="Ex: Unidade Central" />
            </FormField>
            <FormField label="Código" htmlFor="code" required hint="Identificador único, ex: UN-02">
              <Input id="code" name="code" required placeholder="UN-02" />
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

export function EditUnitDialog({ unit }: { unit: Unit }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateUnitAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar unidade">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar unidade</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={unit.id} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="edit-name" required>
              <Input id="edit-name" name="name" required defaultValue={unit.name} />
            </FormField>
            <FormField label="Código" htmlFor="edit-code" required>
              <Input id="edit-code" name="code" required defaultValue={unit.code} />
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
