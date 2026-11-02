"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reopenChecklistComplianceMonthAction } from "@/server/actions/checklist-justification.actions";

/** Apaga o fechamento do mês para a aderência ser recalculada com os dados de agora (ex.: depois de justificar itens). */
export function ReopenComplianceButton({ month, label }: { month: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function reopen() {
    if (!window.confirm(`Reabrir ${label}? O fechamento atual é apagado e o mês é recalculado com os dados de agora (e travado de novo).`)) return;
    start(async () => {
      const res = await reopenChecklistComplianceMonthAction(month);
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
