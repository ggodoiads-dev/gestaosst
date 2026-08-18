"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { setCollaboratorEquipmentAptitudesAction } from "@/server/actions/equipment.actions";
import type { Equipment } from "@/generated/prisma/client";

export function EquipmentAptitudeDialog({
  collaboratorId,
  equipments,
  aptEquipmentIds,
}: {
  collaboratorId: string;
  equipments: Equipment[];
  aptEquipmentIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(aptEquipmentIds));
  const [pending, startTransition] = useTransition();

  function toggle(equipmentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(equipmentId)) next.delete(equipmentId);
      else next.add(equipmentId);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setCollaboratorEquipmentAptitudesAction(collaboratorId, [...selected]);
      if (result.ok) {
        toast.success("Aptidões atualizadas.");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar equipamentos">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Equipamentos que o colaborador pode operar</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-1">
          {equipments.length === 0 && <p className="text-sm text-foreground-subtle">Nenhum equipamento cadastrado ainda.</p>}
          {equipments.map((equipment) => (
            <label key={equipment.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted">
              <Checkbox checked={selected.has(equipment.id)} onCheckedChange={() => toggle(equipment.id)} />
              {equipment.code} — {equipment.name}
            </label>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" loading={pending} onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
