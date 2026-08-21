"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
import { createEquipmentDamageAction, updateEquipmentDamageAction, type ActionResult } from "@/server/actions/equipment-damage.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Equipment, EquipmentDamage } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

type CollaboratorOption = { id: string; name: string };

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateDamageDialog({ equipments, collaborators }: { equipments: Equipment[]; collaborators: CollaboratorOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEquipmentDamageAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [equipmentId, setEquipmentId] = useState(equipments[0]?.id ?? "");
  const [collaboratorId, setCollaboratorId] = useState("none");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} disabled={equipments.length === 0}>
        <Plus /> Registrar avaria
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar avaria</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="collaboratorId" value={collaboratorId === "none" ? "" : collaboratorId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Equipamento" required>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data" htmlFor="date" required>
                <Input id="date" name="date" type="date" required defaultValue={toDateInputValue(new Date())} />
              </FormField>
              <FormField label="Valor (R$)" htmlFor="cost" hint="Opcional — pode preencher depois">
                <Input id="cost" name="cost" inputMode="decimal" placeholder="0,00" />
              </FormField>
            </div>

            <FormField label="Responsável" hint="Opcional — pode deixar em aberto até apurar">
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ainda não apurado</SelectItem>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="O que aconteceu" htmlFor="description" required>
              <Textarea id="description" name="description" rows={3} required placeholder="Ex: bateu a lateral esquerda na estante da Rua 4..." />
            </FormField>

            <FormField label="Observações" htmlFor="notes" hint="Opcional">
              <Textarea id="notes" name="notes" rows={2} />
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

export function EditDamageDialog({
  damage,
  equipments,
  collaborators,
}: {
  damage: EquipmentDamage;
  equipments: Equipment[];
  collaborators: CollaboratorOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateEquipmentDamageAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [equipmentId, setEquipmentId] = useState(damage.equipmentId);
  const [collaboratorId, setCollaboratorId] = useState(damage.collaboratorId ?? "none");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={`Editar ${damage.code}`}>
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {damage.code}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={damage.id} />
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="collaboratorId" value={collaboratorId === "none" ? "" : collaboratorId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Equipamento" required>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data" htmlFor="edit-date" required>
                <Input id="edit-date" name="date" type="date" required defaultValue={toDateInputValue(damage.date)} />
              </FormField>
              <FormField label="Valor (R$)" htmlFor="edit-cost" hint="Opcional">
                <Input id="edit-cost" name="cost" inputMode="decimal" placeholder="0,00" defaultValue={damage.cost ? String(damage.cost) : ""} />
              </FormField>
            </div>

            <FormField label="Responsável" hint="Opcional">
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ainda não apurado</SelectItem>
                  {collaborators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="O que aconteceu" htmlFor="edit-description" required>
              <Textarea id="edit-description" name="description" rows={3} required defaultValue={damage.description} />
            </FormField>

            <FormField label="Observações" htmlFor="edit-notes" hint="Opcional">
              <Textarea id="edit-notes" name="notes" rows={2} defaultValue={damage.notes ?? ""} />
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
