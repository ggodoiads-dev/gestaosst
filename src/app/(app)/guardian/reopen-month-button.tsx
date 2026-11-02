"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reopenGuardianMonthAction } from "@/server/actions/guardian.actions";

/** Apaga o fechamento do mês para ele ser recalculado com os relatos de agora (ex.: depois de importar o que faltava). */
export function ReopenMonthButton({ month, label }: { month: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function reopen() {
    if (!window.confirm(`Reabrir ${label}? O fechamento atual é apagado e o mês é recalculado com os dados de agora (e fechado de novo).`)) return;
    start(async () => {
      const res = await reopenGuardianMonthAction(month);
      if (res.ok) {
        toast.success("Mês reaberto e recalculado.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Button size="sm" variant="secondary" onClick={reopen} loading={pending}>
      Recalcular este mês
    </Button>
  );
}
