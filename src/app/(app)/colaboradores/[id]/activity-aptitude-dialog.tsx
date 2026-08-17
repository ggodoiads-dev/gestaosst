"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { setCollaboratorActivityAptitudesAction } from "@/server/actions/activity.actions";
import type { Activity } from "@/generated/prisma/client";

export function ActivityAptitudeDialog({
  collaboratorId,
  activities,
  aptActivityIds,
}: {
  collaboratorId: string;
  activities: Activity[];
  aptActivityIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(aptActivityIds));
  const [pending, startTransition] = useTransition();

  function toggle(activityId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setCollaboratorActivityAptitudesAction(collaboratorId, [...selected]);
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
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar atividades">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atividades que o colaborador é apto a realizar</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-1">
          {activities.length === 0 && <p className="text-sm text-foreground-subtle">Nenhuma atividade cadastrada ainda.</p>}
          {activities.map((activity) => (
            <label key={activity.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted">
              <Checkbox checked={selected.has(activity.id)} onCheckedChange={() => toggle(activity.id)} />
              {activity.name}
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
