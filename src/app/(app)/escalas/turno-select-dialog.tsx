"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { setCollaboratorTurnoAction } from "@/server/actions/schedule.actions";
import type { ScheduleType, Turno } from "@/generated/prisma/client";

export function TurnoSelectDialog({
  collaboratorId,
  collaboratorName,
  currentTurnoId,
  turnos,
  onClose,
}: {
  collaboratorId: string;
  collaboratorName: string;
  currentTurnoId: string | null;
  turnos: (Turno & { scheduleType: ScheduleType })[];
  onClose: () => void;
}) {
  const [turnoId, setTurnoId] = useState(currentTurnoId ?? "none");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await setCollaboratorTurnoAction(collaboratorId, turnoId === "none" ? null : turnoId);
      toast.success("Turno atualizado.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turno — {collaboratorName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {turnos.length === 0 ? (
            <p className="text-sm text-foreground-subtle">
              Nenhum turno cadastrado ainda. Cadastre em Administração → Tipos de Escala.
            </p>
          ) : (
            <FormField label="Turno" hint="Define automaticamente os dias de trabalho e folga">
              <Select value={turnoId} onValueChange={setTurnoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem turno definido</SelectItem>
                  {turnos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Turno {t.name} ({t.scheduleType.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} loading={isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
