"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reopenAbsenceInterviewAction } from "@/server/actions/absence-interview.actions";

export function ReopenInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await reopenAbsenceInterviewAction(interviewId);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("Entrevista reaberta para edição.");
            router.refresh();
          })
        }
      >
        Reabrir para editar
      </Button>
    </div>
  );
}
