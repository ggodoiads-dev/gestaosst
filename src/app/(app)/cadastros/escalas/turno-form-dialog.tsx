"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createTurnoAction, updateTurnoAction, type ActionResult } from "@/server/actions/schedule.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { ScheduleType, Turno } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TurnoFields({
  scheduleTypes,
  defaults,
  idPrefix,
}: {
  scheduleTypes: ScheduleType[];
  defaults?: {
    name?: string;
    scheduleTypeId?: string;
    startDate?: Date | null;
    startTime?: string | null;
    endTime?: string | null;
  };
  idPrefix: string;
}) {
  const [scheduleTypeId, setScheduleTypeId] = useState(defaults?.scheduleTypeId ?? scheduleTypes[0]?.id ?? "");

  return (
    <>
      <input type="hidden" name="scheduleTypeId" value={scheduleTypeId} />
      <FormField label="Nome do turno" htmlFor={`${idPrefix}-name`} required hint="Ex: A, B, C">
        <Input id={`${idPrefix}-name`} name="name" required placeholder="Ex: A" defaultValue={defaults?.name ?? ""} />
      </FormField>
      <FormField label="Tipo de escala" required>
        <Select value={scheduleTypeId} onValueChange={setScheduleTypeId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {scheduleTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name} ({t.workDays}x{t.restDays})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Data de início do ciclo" htmlFor={`${idPrefix}-startDate`} required hint="Primeiro dia de trabalho do ciclo">
        <Input
          id={`${idPrefix}-startDate`}
          name="startDate"
          type="date"
          required
          defaultValue={toDateInputValue(defaults?.startDate)}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Início do expediente" htmlFor={`${idPrefix}-startTime`} hint="Opcional — ex: 07:00">
          <Input id={`${idPrefix}-startTime`} name="startTime" type="time" defaultValue={defaults?.startTime ?? ""} />
        </FormField>
        <FormField label="Fim do expediente" htmlFor={`${idPrefix}-endTime`} hint="Opcional — ex: 17:00">
          <Input id={`${idPrefix}-endTime`} name="endTime" type="time" defaultValue={defaults?.endTime ?? ""} />
        </FormField>
      </div>
    </>
  );
}

export function CreateTurnoDialog({ scheduleTypes }: { scheduleTypes: ScheduleType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTurnoAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} disabled={scheduleTypes.length === 0}>
        <Plus /> Novo turno
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo turno</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <TurnoFields scheduleTypes={scheduleTypes} idPrefix="new" />
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

export function EditTurnoDialog({ turno, scheduleTypes }: { turno: Turno; scheduleTypes: ScheduleType[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateTurnoAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar turno">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar turno — {turno.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={turno.id} />
          <DialogBody className="flex flex-col gap-4">
            <TurnoFields
              scheduleTypes={scheduleTypes}
              idPrefix={`edit-${turno.id}`}
              defaults={{
                name: turno.name,
                scheduleTypeId: turno.scheduleTypeId,
                startDate: turno.startDate,
                startTime: turno.startTime,
                endTime: turno.endTime,
              }}
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
