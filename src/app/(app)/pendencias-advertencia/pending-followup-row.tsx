"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { markWarningAppliedAction, markAbsenceInterviewDoneAction } from "@/server/actions/schedule.actions";
import { CreateWarningDialog } from "@/app/(app)/colaboradores/[id]/warning-dialog";

export function PendingFollowUpRow({
  noteId,
  collaboratorId,
  collaboratorName,
  dateLabel,
  statusLabel,
  notes,
  warningApplied,
  absenceInterviewDone,
}: {
  noteId: string;
  collaboratorId: string;
  collaboratorName: string;
  dateLabel: string;
  statusLabel: string;
  notes: string;
  warningApplied: boolean;
  absenceInterviewDone: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleWarning(value: boolean) {
    startTransition(async () => {
      const result = await markWarningAppliedAction(noteId, value);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function toggleInterview(value: boolean) {
    startTransition(async () => {
      const result = await markAbsenceInterviewDoneAction(noteId, value);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/colaboradores/${collaboratorId}`} className="font-medium text-accent hover:underline">
            {collaboratorName}
          </Link>
          <p className="text-xs text-foreground-subtle">{dateLabel} · {notes}</p>
        </div>
        <Badge tone="warning">{statusLabel}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={warningApplied} disabled={pending} onCheckedChange={(v) => toggleWarning(!!v)} />
          Advertência aplicada
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={absenceInterviewDone} disabled={pending} onCheckedChange={(v) => toggleInterview(!!v)} />
          Entrevista de ABS feita
        </label>
        <CreateWarningDialog collaboratorId={collaboratorId} />
      </div>
    </div>
  );
}
