"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { justifyChecklistPendingAction } from "@/server/actions/time-clock.actions";
import {
  CHECKLIST_JUSTIFICATION_REASON_OPTIONS,
  type ChecklistJustificationReason,
} from "@/domain/time-clock/checklist-justification-reasons";

export function JustifyChecklistDialog({
  collaboratorId,
  collaboratorName,
  date,
  dateLabel,
  currentReason,
  currentNote,
  onSaved,
}: {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  dateLabel: string;
  currentReason?: ChecklistJustificationReason | null;
  currentNote?: string | null;
  onSaved?: () => void;
}) {
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
      const res = await justifyChecklistPendingAction({ collaboratorId, date, reason, note: note || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      onSaved?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant={currentReason ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {currentReason ? "Editar justificativa" : "Justificar"}
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Justificar checklist — {collaboratorName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-foreground-subtle">{dateLabel}</p>
          <FormField label="Motivo" htmlFor="justify-reason">
            <Select value={reason} onValueChange={(v) => setReason(v as ChecklistJustificationReason)}>
              <SelectTrigger id="justify-reason">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {CHECKLIST_JUSTIFICATION_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Observação" htmlFor="justify-note" hint="Opcional">
            <Textarea id="justify-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
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
