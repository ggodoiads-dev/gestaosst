"use client";

import { useActionState, useState } from "react";
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
import {
  createScheduleTypeAction,
  updateScheduleTypeAction,
  type ActionResult,
} from "@/server/actions/schedule.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { ScheduleType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

function ScheduleTypeFields({
  defaults,
  idPrefix,
}: {
  defaults?: { name?: string; workDays?: number; restDays?: number };
  idPrefix: string;
}) {
  return (
    <>
      <FormField label="Nome" htmlFor={`${idPrefix}-name`} required hint="Ex: 6x2">
        <Input id={`${idPrefix}-name`} name="name" required placeholder="Ex: 6x2" defaultValue={defaults?.name ?? ""} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Dias de trabalho" htmlFor={`${idPrefix}-workDays`} required>
          <Input
            id={`${idPrefix}-workDays`}
            name="workDays"
            type="number"
            min={1}
            required
            defaultValue={defaults?.workDays ?? ""}
          />
        </FormField>
        <FormField label="Dias de folga" htmlFor={`${idPrefix}-restDays`} required>
          <Input
            id={`${idPrefix}-restDays`}
            name="restDays"
            type="number"
            min={1}
            required
            defaultValue={defaults?.restDays ?? ""}
          />
        </FormField>
      </div>
    </>
  );
}

export function CreateScheduleTypeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createScheduleTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo tipo de escala
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tipo de escala</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <ScheduleTypeFields idPrefix="new" />
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

export function EditScheduleTypeDialog({ type }: { type: ScheduleType }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateScheduleTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar tipo de escala">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tipo de escala</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={type.id} />
          <DialogBody className="flex flex-col gap-4">
            <ScheduleTypeFields
              idPrefix={`edit-${type.id}`}
              defaults={{ name: type.name, workDays: type.workDays, restDays: type.restDays }}
            />
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
