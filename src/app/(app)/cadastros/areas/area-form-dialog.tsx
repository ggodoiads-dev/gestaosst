"use client";

import { useActionState, useState } from "react";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
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
import { createAreaAction, updateAreaAction, type ActionResult } from "@/server/actions/masterdata.actions";
import type { Area, Unit } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateAreaDialog({ units }: { units: Unit[] }) {
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createAreaAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nova área
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova área</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="unitId" value={unitId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Unidade" required>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Nome" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="Ex: Expedição" />
            </FormField>
            <FormField label="Código" htmlFor="code" required hint="Identificador único, ex: AR-EXP">
              <Input id="code" name="code" required placeholder="AR-EXP" />
            </FormField>
            <FormField label="Setor" htmlFor="sector" hint="Opcional">
              <Input id="sector" name="sector" placeholder="Opcional" />
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

export function EditAreaDialog({ area, units }: { area: Area; units: Unit[] }) {
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState(area.unitId);
  const [state, formAction, pending] = useActionState(updateAreaAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar área">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar área</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={area.id} />
          <input type="hidden" name="unitId" value={unitId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Unidade" required>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Nome" htmlFor="edit-area-name" required>
              <Input id="edit-area-name" name="name" required defaultValue={area.name} />
            </FormField>
            <FormField label="Código" htmlFor="edit-area-code" required>
              <Input id="edit-area-code" name="code" required defaultValue={area.code} />
            </FormField>
            <FormField label="Setor" htmlFor="edit-area-sector">
              <Input id="edit-area-sector" name="sector" defaultValue={area.sector ?? ""} />
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
