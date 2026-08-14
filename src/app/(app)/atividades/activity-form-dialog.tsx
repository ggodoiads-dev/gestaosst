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
  createActivityAction,
  updateActivityAction,
  type ActionResult,
} from "@/server/actions/activity.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Activity } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

function ActivityFields({
  defaults,
  idPrefix,
}: {
  defaults?: { name?: string; code?: string | null; description?: string | null; unit?: string | null };
  idPrefix: string;
}) {
  return (
    <>
      <FormField label="Nome da atividade" htmlFor={`${idPrefix}-name`} required>
        <Input id={`${idPrefix}-name`} name="name" required placeholder="Ex: Troca de bateria de empilhadeira" defaultValue={defaults?.name ?? ""} />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Código" htmlFor={`${idPrefix}-code`} hint="Opcional">
          <Input id={`${idPrefix}-code`} name="code" placeholder="Opcional" defaultValue={defaults?.code ?? ""} />
        </FormField>
        <FormField
          label="Unidade de produção"
          htmlFor={`${idPrefix}-unit`}
          hint="Opcional — ex: caminhões, paletes, chapas. Habilita quantidade em Produtividade"
        >
          <Input id={`${idPrefix}-unit`} name="unit" placeholder="Ex: chapas" defaultValue={defaults?.unit ?? ""} />
        </FormField>
      </div>
      <FormField label="Descrição" htmlFor={`${idPrefix}-description`} hint="Opcional">
        <Textarea id={`${idPrefix}-description`} name="description" rows={3} defaultValue={defaults?.description ?? ""} />
      </FormField>
    </>
  );
}

export function CreateActivityDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createActivityAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nova atividade
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <ActivityFields idPrefix="new" />
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

export function EditActivityDialog({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateActivityAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar atividade">
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar atividade — {activity.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={activity.id} />
          <DialogBody className="flex flex-col gap-4">
            <ActivityFields
              idPrefix={`edit-${activity.id}`}
              defaults={{ name: activity.name, code: activity.code, description: activity.description, unit: activity.unit }}
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
