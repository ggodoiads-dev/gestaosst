"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { setCollaboratorScheduleAction } from "@/server/actions/schedule.actions";
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
  const [firstRestDate, setFirstRestDate] = useState("");
  const [secondRestDate, setSecondRestDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTurno = turnos.find((t) => t.id === turnoId);
  const turnoChanged = turnoId !== (currentTurnoId ?? "none");

  function handleTurnoChange(value: string) {
    setTurnoId(value);
    setFirstRestDate("");
    setSecondRestDate("");
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await setCollaboratorScheduleAction(collaboratorId, {
        turnoId: turnoId === "none" ? null : turnoId,
        firstRestDate: firstRestDate || null,
        secondRestDate: secondRestDate || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Escala atualizada.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escala — {collaboratorName}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {turnos.length === 0 ? (
            <p className="text-sm text-foreground-subtle">
              Nenhum turno cadastrado ainda. Cadastre em Administração → Tipos de Escala.
            </p>
          ) : (
            <>
              <FormField label="Turno" hint="Define os dias de trabalho/folga e o horário do expediente">
                <Select value={turnoId} onValueChange={handleTurnoChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem turno definido</SelectItem>
                    {turnos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>Turno {t.name} ({t.scheduleType.name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {selectedTurno && (
                <>
                  <p className="text-xs text-foreground-subtle">
                    Escala {selectedTurno.scheduleType.name}: {selectedTurno.scheduleType.workDays} dia(s) de
                    trabalho, {selectedTurno.scheduleType.restDays} de folga. Informe quando são os primeiros
                    dias de folga dela que o sistema calcula o resto da escala sozinho.
                    {!turnoChanged && " Deixe em branco pra manter a escala já cadastrada."}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="1º dia de folga" htmlFor="firstRestDate" required={turnoChanged}>
                      <Input
                        id="firstRestDate"
                        type="date"
                        value={firstRestDate}
                        onChange={(e) => setFirstRestDate(e.target.value)}
                      />
                    </FormField>
                    <FormField label="2º dia de folga" htmlFor="secondRestDate" hint="Opcional, só confere">
                      <Input
                        id="secondRestDate"
                        type="date"
                        value={secondRestDate}
                        onChange={(e) => setSecondRestDate(e.target.value)}
                      />
                    </FormField>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            loading={isPending}
            disabled={Boolean(selectedTurno) && turnoChanged && !firstRestDate}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
