"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
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
import { createJobFunctionAction, type ActionResult } from "@/server/actions/epi.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";

const initialState: ActionResult = { ok: true };

export function CreateJobFunctionDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createJobFunctionAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nova função
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova função</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="new-function-name" required hint="Ex: Operador de Empilhadeira">
              <Input id="new-function-name" name="name" required placeholder="Ex: Operador de Empilhadeira" />
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
