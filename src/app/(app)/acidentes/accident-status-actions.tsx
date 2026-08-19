"use client";

import { useTransition } from "react";
import { Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SoftDeleteButton } from "@/components/domain/soft-delete-button";
import { updateAccidentStatusAction } from "@/server/actions/accident.actions";
import type { AccidentStatus } from "@/generated/prisma/enums";

export function AccidentStatusActions({ id, status, code }: { id: string; status: AccidentStatus; code: string }) {
  const [isPending, startTransition] = useTransition();

  function transition(next: AccidentStatus, message: string) {
    startTransition(async () => {
      await updateAccidentStatusAction(id, next);
      toast.success(message);
    });
  }

  if (status === "CANCELADA") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "ABERTO" && (
        <Button size="sm" variant="secondary" loading={isPending} onClick={() => transition("EM_INVESTIGACAO", "Investigação iniciada.")}>
          <Search className="size-4" /> Iniciar investigação
        </Button>
      )}
      {status === "EM_INVESTIGACAO" && (
        <Button size="sm" loading={isPending} onClick={() => transition("CONCLUIDO", "Acidente concluído.")}>
          <CheckCircle2 className="size-4" /> Concluir investigação
        </Button>
      )}
      <SoftDeleteButton
        title={`Cancelar ${code}?`}
        description="O acidente fica marcado como cancelado e some das listas ativas. Nada é apagado — pode reverter depois se precisar."
        ariaLabel="Cancelar acidente"
        successMessage={`${code} cancelado.`}
        onConfirm={() => updateAccidentStatusAction(id, "CANCELADA")}
      />
    </div>
  );
}
