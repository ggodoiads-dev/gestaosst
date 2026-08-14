"use client";

import { useTransition } from "react";
import { Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateAccidentStatusAction } from "@/server/actions/accident.actions";
import type { AccidentStatus } from "@/generated/prisma/enums";

export function AccidentStatusActions({ id, status }: { id: string; status: AccidentStatus }) {
  const [isPending, startTransition] = useTransition();

  function transition(next: AccidentStatus, message: string) {
    startTransition(async () => {
      await updateAccidentStatusAction(id, next);
      toast.success(message);
    });
  }

  if (status === "ABERTO") {
    return (
      <Button size="sm" variant="secondary" loading={isPending} onClick={() => transition("EM_INVESTIGACAO", "Investigação iniciada.")}>
        <Search className="size-4" /> Iniciar investigação
      </Button>
    );
  }

  if (status === "EM_INVESTIGACAO") {
    return (
      <Button size="sm" loading={isPending} onClick={() => transition("CONCLUIDO", "Acidente concluído.")}>
        <CheckCircle2 className="size-4" /> Concluir investigação
      </Button>
    );
  }

  return null;
}
