"use client";

import { useActionState, useState, useTransition } from "react";
import { Target, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  upsertProductivityGoalAction,
  deleteProductivityGoalAction,
  type ActionResult,
} from "@/server/actions/productivity.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Collaborator, Activity } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type ExistingGoal = { id: string; collaboratorId: string; activityId: string; targetQuantity: number };

export function ProductivityGoalDialog({
  collaborators,
  activities,
  month,
  year,
  goal,
  defaultCollaboratorId,
}: {
  collaborators: Collaborator[];
  activities: Activity[];
  month: number;
  year: number;
  goal?: ExistingGoal;
  defaultCollaboratorId?: string;
}) {
  const isEdit = !!goal;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(upsertProductivityGoalAction, initialState);
  const [collaboratorId, setCollaboratorId] = useState(goal?.collaboratorId ?? defaultCollaboratorId ?? "");
  const [activityId, setActivityId] = useState(goal?.activityId ?? activities[0]?.id ?? "");
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar meta">
          <Pencil className="size-4" />
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Target /> Definir meta
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meta mensal — {MONTH_LABELS[month - 1]} de {year}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="activityId" value={activityId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Colaborador" required>
              <Select value={collaboratorId} onValueChange={setCollaboratorId} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                <SelectContent>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Atividade" required>
              <Select value={activityId} onValueChange={setActivityId} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
                <SelectContent>
                  {activities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.unit ? ` (${a.unit})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Meta do mês" htmlFor="targetQuantity" required>
              <Input
                id="targetQuantity"
                name="targetQuantity"
                type="number"
                min={1}
                placeholder="Ex: 500"
                defaultValue={goal?.targetQuantity ?? ""}
              />
            </FormField>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending} disabled={!collaboratorId || !activityId}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProductivityGoalButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="icon"
      variant="ghost"
      loading={pending}
      aria-label="Remover meta"
      onClick={() =>
        startTransition(async () => {
          await deleteProductivityGoalAction(id);
          toast.success("Meta removida.");
        })
      }
    >
      <Trash2 className="size-4 text-danger" />
    </Button>
  );
}
