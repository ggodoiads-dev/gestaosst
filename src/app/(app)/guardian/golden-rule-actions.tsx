"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveGoldenRuleAction } from "@/server/actions/guardian.actions";
import { MDT_STEP_OPTIONS, type GoldenRuleOutcome } from "@/domain/guardian/golden-rule";

/** Conclusão de um relato de Regra de Ouro: foi aplicado MDT ou foi desconsiderado (com uma observação opcional). */
export function GoldenRuleActions({ guardianId, decided }: { guardianId: string; decided: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  // "Aplicado MDT" pede para escolher qual medida disciplinar foi aplicada.
  const [choosing, setChoosing] = useState(false);
  const [step, setStep] = useState("");

  function save(outcome: GoldenRuleOutcome | null, mdtStep: string | null = null) {
    start(async () => {
      const res = await resolveGoldenRuleAction(guardianId, outcome, outcome ? note : null, mdtStep);
      if (res.ok) {
        toast.success(outcome === null ? "Reaberto: voltou para pendente." : "Conclusão salva.");
        setNote("");
        setStep("");
        setChoosing(false);
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

  if (choosing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
        <label className="flex items-center gap-2 text-xs font-medium text-foreground">
          Qual MDT foi aplicado?
          <select value={step} onChange={(e) => setStep(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-xs text-foreground" aria-label="Qual MDT foi aplicado">
            <option value="">Escolher…</option>
            {MDT_STEP_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" className="h-8 w-48 text-xs" maxLength={500} />
        <Button size="sm" loading={pending} disabled={!step} onClick={() => save("APLICADO_MDT", step)}>
          Confirmar
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setChoosing(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" className="h-8 w-52 text-xs" maxLength={500} />
      <Button size="sm" loading={pending} onClick={() => setChoosing(true)}>
        Aplicado MDT
      </Button>
      <Button size="sm" variant="secondary" loading={pending} onClick={() => save("DESCONSIDERADO")}>
        Desconsiderado
      </Button>
    </div>
  );
}
