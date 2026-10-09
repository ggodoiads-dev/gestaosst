"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setJobFunctionDtoExemptAction } from "@/server/actions/epi.actions";

/** Marcada = ADM/liderança: não é avaliada em DTO (não entra nas sugestões nem no calendário). */
export function DtoExemptToggle({ jobFunctionId, defaultChecked }: { jobFunctionId: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, startTransition] = useTransition();

  function handleChange(value: boolean) {
    setChecked(value);
    startTransition(async () => {
      const res = await setJobFunctionDtoExemptAction(jobFunctionId, value);
      if (!res.ok) {
        setChecked(!value);
        toast.error(res.error);
      }
    });
  }

  return (
    <Checkbox
      checked={checked}
      disabled={pending}
      onCheckedChange={(value) => handleChange(value === true)}
      aria-label="Não é avaliado em DTO (ADM/liderança)"
    />
  );
}
