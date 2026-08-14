"use client";

import { useActionState, useState } from "react";
import { Wrench, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField, Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  startMaintenanceAction,
  completeMaintenanceAction,
  type ActionResult,
} from "@/server/actions/maintenance.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";

const initialState: ActionResult = { ok: true };

export function StartMaintenanceDialog({ equipmentId, code }: { equipmentId: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(startMaintenanceAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Wrench /> Colocar em manutenção
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Colocar {code} em manutenção</DialogTitle>
          <DialogDescription>
            O equipamento continuará indisponível para checklist. Quando a manutenção terminar,
            volte aqui para registrar o que foi feito.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <DialogBody>
            <FormField label="Motivo / o que será feito" htmlFor="note" hint="Opcional">
              <Textarea id="note" name="note" rows={3} placeholder="Ex: troca da roda dianteira danificada" />
            </FormField>
            {!state.ok && <p className="mt-2 text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Colocar em manutenção</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_OPTIONS = [
  { value: "LIBERADO", label: "Concluída — voltar para operação" },
  { value: "BLOQUEADO", label: "Não resolvido — manter bloqueado" },
  { value: "EM_MANUTENCAO", label: "Ainda em andamento — continuar em manutenção" },
];

export function CompleteMaintenanceDialog({ equipmentId, code }: { equipmentId: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(completeMaintenanceAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [newStatus, setNewStatus] = useState("LIBERADO");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 /> Registrar manutenção
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar manutenção — {code}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="newStatus" value={newStatus} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="O que foi feito / o que foi trocado" htmlFor="description" required>
              <Textarea
                id="description"
                name="description"
                rows={3}
                required
                placeholder="Ex: roda dianteira trocada, sistema de freio revisado"
              />
            </FormField>
            <div className="flex flex-col gap-2">
              <Label>Situação do equipamento após a manutenção</Label>
              <RadioGroup value={newStatus} onValueChange={setNewStatus}>
                {STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 rounded-md border border-border-strong px-3.5 py-2.5 text-sm cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft"
                  >
                    <RadioGroupItem value={opt.value} />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
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
