"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setDpvimCancelledAction } from "@/server/actions/dpvim.actions";

/** Cancela a DPVIM (cadastro errado, carga que não veio) ou a reabre. */
export function CancelDpvimButton({ id, cancelled }: { id: string; cancelled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    if (!cancelled && !window.confirm("Cancelar esta DPVIM? Ela deixa de contar nas atrasadas.")) return;
    start(async () => {
      const res = await setDpvimCancelledAction(id, !cancelled);
      if (res.ok) {
        toast.success(cancelled ? "DPVIM reaberta." : "DPVIM cancelada.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Button size="sm" variant={cancelled ? "secondary" : "outlineDanger"} loading={pending} onClick={run}>
      {cancelled ? "Reabrir" : "Cancelar DPVIM"}
    </Button>
  );
}
