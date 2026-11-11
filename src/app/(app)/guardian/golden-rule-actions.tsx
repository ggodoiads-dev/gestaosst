"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveGoldenRuleAction } from "@/server/actions/guardian.actions";
import type { GoldenRuleOutcome } from "@/domain/guardian/golden-rule";

/** Conclusão de um relato de Regra de Ouro: foi aplicado MDT ou foi desconsiderado (com uma observação opcional). */
export function GoldenRuleActions({ guardianId, decided }: { guardianId: string; decided: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  function save(outcome: GoldenRuleOutcome | null) {
    start(async () => {
      const res = await resolveGoldenRuleAction(guardianId, outcome, outcome ? note : null);
      if (res.ok) {
        toast.success(outcome === null ? "Reaberto: voltou para pendente." : "Conclusão salva.");
        setNote("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (decided) {
    return (
      <Button size="sm" variant="ghost" loading={pending} onClick={() => save(null)}>
        Reabrir
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" className="h-8 w-52 text-xs" maxLength={500} />
      <Button size="sm" loading={pending} onClick={() => save("APLICADO_MDT")}>
        Aplicado MDT
      </Button>
      <Button size="sm" variant="secondary" loading={pending} onClick={() => save("DESCONSIDERADO")}>
        Desconsiderado
      </Button>
    </div>
  );
}
