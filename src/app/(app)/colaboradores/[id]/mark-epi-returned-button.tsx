"use client";

import { useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markEpiDeliveryReturnedAction } from "@/server/actions/epi.actions";

export function MarkEpiReturnedButton({ id, collaboratorId }: { id: string; collaboratorId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markEpiDeliveryReturnedAction(id, collaboratorId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Devolução registrada.");
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
      <Undo2 className="size-3.5" /> Marcar devolução
    </Button>
  );
}
