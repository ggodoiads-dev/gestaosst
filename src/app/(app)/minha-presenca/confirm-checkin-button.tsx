"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmMyShiftCheckInAction } from "@/server/actions/shift-checkin.actions";

export function ConfirmCheckInButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await confirmMyShiftCheckInAction();
          toast.success("Presença confirmada!");
        })
      }
    >
      <CheckCircle2 /> Confirmar presença
    </Button>
  );
}
