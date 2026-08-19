"use client";

import { useActionState, useState, useTransition } from "react";
import { Link2, GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  assignTemplateAction,
  createNewDraftVersionAction,
  syncAreaTemplateEquipmentAction,
  type ActionResult,
} from "@/server/actions/checklist-template.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { toast } from "sonner";
import type { Equipment } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function NewDraftVersionButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await createNewDraftVersionAction(templateId);
      toast.success("Nova versão em rascunho criada.");
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
      <GitBranch /> Nova versão
    </Button>
  );
}

export function SyncAreaEquipmentButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncAreaTemplateEquipmentAction(templateId);
      if (result.ok) toast.success("Equipamentos da área sincronizados.");
      else toast.error(result.error);
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
      <RefreshCw /> Sincronizar equipamentos da área
    </Button>
  );
}

export function AssignEquipmentDialog({
  templateId,
  equipments,
  assignedIds,
}: {
  templateId: string;
  equipments: (Equipment & { area: { name: string } })[];
  assignedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignTemplateAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Link2 /> Vincular a equipamentos
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular modelo a equipamentos</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="templateId" value={templateId} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="equipmentIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {equipments.length === 0 && (
              <p className="text-sm text-foreground-subtle">
                Nenhum equipamento do tipo compatível cadastrado ainda.
              </p>
            )}
            {equipments.map((eq) => (
              <label key={eq.id} className="flex items-center gap-2 text-sm text-foreground-muted">
                <Checkbox checked={selected.has(eq.id)} onCheckedChange={() => toggle(eq.id)} />
                {eq.code} — {eq.name} ({eq.area.name})
              </label>
            ))}
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
