"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";
import { confirmShiftCheckInForAction, removeShiftCheckInForAction } from "@/server/actions/shift-checkin.actions";

export function ShiftCheckInPanel({
  collaboratorId,
  status,
  checkedIn,
  checkedInAt,
}: {
  collaboratorId: string;
  status: "TRABALHO" | "FOLGA";
  checkedIn: boolean;
  checkedInAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "FOLGA") {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
        <span className="text-foreground-subtle">Hoje é folga — não precisa confirmar presença.</span>
      </div>
    );
  }

  function handleConfirm() {
    startTransition(async () => {
      await confirmShiftCheckInForAction(collaboratorId);
      toast.success("Presença confirmada.");
    });
  }

  function handleUndo() {
    startTransition(async () => {
      await removeShiftCheckInForAction(collaboratorId);
      toast.success("Confirmação desfeita.");
    });
  }

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
      {checkedIn ? (
        <>
          <Badge tone="success">Presença confirmada{checkedInAt ? ` às ${formatTime(checkedInAt)}` : ""}</Badge>
          <Button size="sm" variant="ghost" onClick={handleUndo} loading={pending} className="ml-auto">
            Desfazer
          </Button>
        </>
      ) : (
        <>
          <span className="text-foreground-subtle">Ainda não confirmou presença hoje.</span>
          <Button size="sm" onClick={handleConfirm} loading={pending} className="ml-auto">
            <CheckCircle2 className="size-3.5" /> Confirmar presença
          </Button>
        </>
      )}
    </div>
  );
}
