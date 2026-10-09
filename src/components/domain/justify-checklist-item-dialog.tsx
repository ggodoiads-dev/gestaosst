"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  justifyChecklistItemAction,
  removeChecklistItemJustificationAction,
} from "@/server/actions/checklist-justification.actions";
import {
  CHECKLIST_ITEM_JUSTIFICATION_REASON_OPTIONS,
  type ChecklistJustificationReason,
} from "@/domain/time-clock/checklist-justification-reasons";

export function JustifyChecklistItemDialog({
  collaboratorId,
  collaboratorName,
  dayKey,
  itemIds,
  itemLabel,
  triggerLabel,
  currentReason,
  currentNote,
}: {
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  itemIds: string[];
  itemLabel: string;
  triggerLabel?: string;
  currentReason?: ChecklistJustificationReason | null;
  currentNote?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ChecklistJustificationReason | "">(currentReason ?? "");
  const [note, setNote] = useState(currentNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!reason) {
      setError("Escolha um motivo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await justifyChecklistItemAction({ collaboratorId, dayKey, itemIds, reason, note });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const res = await removeChecklistItemJustificationAction({ collaboratorId, dayKey, itemId: itemIds[0] });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant={currentReason ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {currentReason ? "Editar justificativa" : (triggerLabel ?? "Justificar e concluir")}
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Justificar {itemLabel}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-foreground-subtle">
            {collaboratorName}. Com um motivo válido, o item passa a contar como concluído na aderência — e a justificativa
            fica registrada com o seu nome.
          </p>
          <FormField label="Motivo" htmlFor="justify-item-reason">
            <Select value={reason} onValueChange={(v) => setReason(v as ChecklistJustificationReason)}>
              <SelectTrigger id="justify-item-reason">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {CHECKLIST_ITEM_JUSTIFICATION_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                    {opt.countsAsCompliant ? "" : " (não conclui o item)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="O que aconteceu" htmlFor="justify-item-note">
            <Textarea id="justify-item-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          {currentReason && itemIds.length === 1 && (
            <Button type="button" variant="ghost" onClick={handleRemove} loading={pending}>
              Desfazer
            </Button>
          )}
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} loading={pending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
