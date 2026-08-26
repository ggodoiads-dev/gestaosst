"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setJobFunctionRequiresNrAction } from "@/server/actions/epi.actions";

export function RequiresNrToggle({ jobFunctionId, defaultChecked }: { jobFunctionId: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, startTransition] = useTransition();

  function handleChange(value: boolean) {
    setChecked(value);
    startTransition(async () => {
      const res = await setJobFunctionRequiresNrAction(jobFunctionId, value);
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
      aria-label="Precisa de NR"
    />
  );
}
