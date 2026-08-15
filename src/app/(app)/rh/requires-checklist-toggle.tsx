"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { setCollaboratorRequiresChecklistAction } from "@/server/actions/hr.actions";

export function RequiresChecklistToggle({
  collaboratorId,
  defaultChecked,
}: {
  collaboratorId: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, startTransition] = useTransition();

  function handleChange(value: boolean) {
    setChecked(value);
    startTransition(async () => {
      const res = await setCollaboratorRequiresChecklistAction(collaboratorId, value);
      if (!res.ok) setChecked(!value);
    });
  }

  return (
    <Checkbox
      checked={checked}
      disabled={pending}
      onCheckedChange={(value) => handleChange(value === true)}
      aria-label="Precisa de checklist"
    />
  );
}
