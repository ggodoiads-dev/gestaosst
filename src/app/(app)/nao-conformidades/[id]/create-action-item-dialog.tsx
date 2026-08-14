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
import { createActionItemAction, type ActionResult } from "@/server/actions/nonconformity.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { User } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const PRIORITY_OPTIONS = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
];

export function CreateActionItemDialog({ nonconformityId, users }: { nonconformityId: string; users: User[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createActionItemAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [responsibleId, setResponsibleId] = useState(users[0]?.id ?? "");
  const [priority, setPriority] = useState("MEDIA");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nova ação
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova ação corretiva</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="nonconformityId" value={nonconformityId} />
          <input type="hidden" name="responsibleId" value={responsibleId} />
          <input type="hidden" name="priority" value={priority} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Descrição da ação" htmlFor="description" required>
              <Textarea id="description" name="description" rows={3} required placeholder="O que precisa ser feito" />
            </FormField>
            <FormField label="Responsável" required>
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Prazo" htmlFor="dueDate" required>
                <Input id="dueDate" name="dueDate" type="date" required />
              </FormField>
              <FormField label="Prioridade" required>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Criar ação</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
