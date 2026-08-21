"use client";

import { useTransition } from "react";
import { Wrench, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateEquipmentDamageStatusAction } from "@/server/actions/equipment-damage.actions";
import type { EquipmentDamageStatus } from "@/generated/prisma/enums";

export function DamageStatusActions({ id, status }: { id: string; status: EquipmentDamageStatus }) {
  const [isPending, startTransition] = useTransition();

  function transition(next: EquipmentDamageStatus, message: string) {
    startTransition(async () => {
      await updateEquipmentDamageStatusAction(id, next);
      toast.success(message);
    });
  }

  if (status === "RESOLVIDO") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "ABERTO" && (
        <Button size="sm" variant="secondary" loading={isPending} onClick={() => transition("EM_REPARO", "Avaria em reparo.")}>
          <Wrench className="size-4" /> Colocar em reparo
        </Button>
      )}
      <Button size="sm" loading={isPending} onClick={() => transition("RESOLVIDO", "Avaria resolvida.")}>
        <CheckCircle2 className="size-4" /> Marcar como resolvida
      </Button>
    </div>
  );
}
