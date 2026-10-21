"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { removeChecklistItemJustificationsAction } from "@/server/actions/checklist-justification.actions";

/** Desfaz justificativas (de um item, ou todas as do dia): os itens voltam a contar como pendentes se não foram feitos. */
export function UndoChecklistJustificationsButton({
  collaboratorId,
  collaboratorName,
  dayKey,
  itemIds,
  count,
  label = "Desfazer",
}: {
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  /** Sem lista = desfaz todas as justificativas do dia dessa pessoa. */
  itemIds?: string[];
  count: number;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await removeChecklistItemJustificationsAction({ collaboratorId, dayKey, itemIds });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Justificativa desfeita — o que não foi feito voltou a ficar pendente.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setOpen(true)}>
        <Undo2 className="size-4" /> {label}
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desfazer {count > 1 ? `${count} justificativas` : "a justificativa"}?</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">{collaboratorName}</p>
          <p className="text-foreground-subtle">
            Os itens justificados deixam de contar como concluídos e voltam a aparecer como pendentes (a não ser que tenham sido feitos de verdade). Dá para
            justificar de novo depois.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button variant="danger" onClick={confirm} loading={pending}>Desfazer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
