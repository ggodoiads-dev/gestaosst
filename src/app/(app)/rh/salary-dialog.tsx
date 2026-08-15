"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { setCollaboratorSalaryAction, type ActionResult } from "@/server/actions/hr.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";

const initialState: ActionResult = { ok: true };

export function EditSalaryDialog({
  collaboratorId,
  collaboratorName,
  currentSalary,
}: {
  collaboratorId: string;
  collaboratorName: string;
  currentSalary: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setCollaboratorSalaryAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar salário">
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Salário — {collaboratorName}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={collaboratorId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Salário (R$)" htmlFor="salary" hint="Deixe em branco para remover">
              <Input
                id="salary"
                name="salary"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={currentSalary ?? ""}
              />
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
