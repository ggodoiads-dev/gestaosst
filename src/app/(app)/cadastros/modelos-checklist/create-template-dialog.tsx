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
import { createTemplateAction, type ActionResult } from "@/server/actions/checklist-template.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { EquipmentType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function CreateTemplateDialog({ types }: { types: EquipmentType[] }) {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo modelo
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo modelo de checklist</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="equipmentTypeId" value={typeId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="name" required hint="Ex: Inspeção Diária — Paleteira Elétrica">
              <Input id="name" name="name" required />
            </FormField>
            <FormField label="Tipo de equipamento" required>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="submit" loading={pending}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
