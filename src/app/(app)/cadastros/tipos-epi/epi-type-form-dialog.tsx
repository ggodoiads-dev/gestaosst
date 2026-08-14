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
  createEpiTypeAction,
  updateEpiTypeAction,
  type ActionResult,
} from "@/server/actions/epi.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { EpiType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

function EpiTypeFields({
  defaults,
  idPrefix,
}: {
  defaults?: { name?: string; defaultCa?: string | null; validityMonths?: number | null };
  idPrefix: string;
}) {
  return (
    <>
      <FormField label="Nome do EPI" htmlFor={`${idPrefix}-name`} required hint="Ex: Capacete de Segurança">
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          placeholder="Ex: Capacete de Segurança"
          defaultValue={defaults?.name ?? ""}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="CA padrão" htmlFor={`${idPrefix}-defaultCa`} hint="Certificado de Aprovação">
          <Input
            id={`${idPrefix}-defaultCa`}
            name="defaultCa"
            placeholder="Ex: 31.443"
            defaultValue={defaults?.defaultCa ?? ""}
          />
        </FormField>
        <FormField label="Validade (meses)" htmlFor={`${idPrefix}-validityMonths`} hint="Deixe vazio se não expira">
          <Input
            id={`${idPrefix}-validityMonths`}
            name="validityMonths"
            type="number"
            min={1}
            placeholder="Ex: 12"
            defaultValue={defaults?.validityMonths ?? ""}
          />
        </FormField>
      </div>
    </>
  );
}

export function CreateEpiTypeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEpiTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo EPI
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tipo de EPI</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <EpiTypeFields idPrefix="new" />
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

export function EditEpiTypeDialog({ type }: { type: EpiType }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateEpiTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar tipo de EPI">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tipo de EPI</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={type.id} />
          <DialogBody className="flex flex-col gap-4">
            <EpiTypeFields
              idPrefix={`edit-${type.id}`}
              defaults={{ name: type.name, defaultCa: type.defaultCa, validityMonths: type.validityMonths }}
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
