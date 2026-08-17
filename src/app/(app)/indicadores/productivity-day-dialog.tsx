"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  createProductivityEntryAction,
  deleteProductivityEntryAction,
  type ActionResult,
} from "@/server/actions/productivity.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { parseDateOnly, formatDate } from "@/lib/dates";
import type { Activity } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

type EntryData = {
  id: string;
  quantity: number | null;
  notes: string | null;
  activity: Activity;
};

export function ProductivityDayDialog({
  collaboratorId,
  collaboratorName,
  date,
  entries,
  activities,
  canEdit = true,
  onClose,
}: {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  entries: EntryData[];
  activities: Activity[];
  canEdit?: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createProductivityEntryAction, initialState);
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [isDeleting, startDelete] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useCloseOnSuccess(pending, state, () => {
    // não fecha o dialog — só limpa o formulário, pra permitir lançar vários no mesmo dia
  });

  const selectedActivity = activities.find((a) => a.id === activityId);

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deleteProductivityEntryAction(id);
      toast.success("Lançamento removido.");
      setDeletingId(null);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{collaboratorName}</DialogTitle>
          <DialogDescription>{formatDate(parseDateOnly(date))}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {entries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {entry.activity.name}
                      {entry.quantity != null && ` — ${entry.quantity} ${entry.activity.unit ?? ""}`}
                    </p>
                    {entry.notes && <p className="text-xs text-foreground-subtle truncate">{entry.notes}</p>}
                  </div>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(entry.id)}
                      loading={isDeleting && deletingId === entry.id}
                      aria-label="Remover lançamento"
                    >
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!canEdit ? (
            entries.length === 0 && (
              <p className="text-sm text-foreground-subtle">Nenhum lançamento neste dia.</p>
            )
          ) : activities.length === 0 ? (
            <p className="text-sm text-foreground-subtle">
              Nenhuma atividade cadastrada ainda. Cadastre em Atividades e Documentos.
            </p>
          ) : (
            <form action={formAction} className="flex flex-col gap-4 border-t border-border pt-4">
              <input type="hidden" name="collaboratorId" value={collaboratorId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="activityId" value={activityId} />
              <FormField label="Atividade" required>
                <Select value={activityId} onValueChange={setActivityId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activities.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label={selectedActivity?.unit ? `Quantidade (${selectedActivity.unit})` : "Quantidade"}
                htmlFor="quantity"
                hint="Opcional"
              >
                <Input id="quantity" name="quantity" type="number" min={0} step={1} placeholder="0" />
              </FormField>
              <FormField label="Observação" htmlFor="notes" hint="Opcional">
                <Textarea id="notes" name="notes" rows={2} placeholder="Opcional" />
              </FormField>
              {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
              <Button type="submit" loading={pending} className="self-start">Adicionar lançamento</Button>
            </form>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
