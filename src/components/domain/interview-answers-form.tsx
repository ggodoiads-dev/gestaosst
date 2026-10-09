"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/domain/interview-fields";
import { submitAbsenceInterviewAnswersAction } from "@/server/actions/absence-interview.actions";
import type { EmployeeAnswers } from "@/domain/absence-interview/form";

/** Parte A — o que o colaborador responde: o que aconteceu e os 5 porquês (o RH também pode preencher por quem não tem login). */
export function InterviewAnswersForm({
  interviewId,
  initial,
  onBehalf,
}: {
  interviewId: string;
  initial: EmployeeAnswers | null;
  onBehalf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState(initial?.description ?? "");
  const [whys, setWhys] = useState<string[]>([0, 1, 2, 3, 4].map((i) => initial?.fiveWhys?.[i] ?? ""));

  function submit() {
    startTransition(async () => {
      const res = await submitAbsenceInterviewAnswersAction(interviewId, { description, fiveWhys: whys });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(onBehalf ? "Relato registrado." : "Resposta enviada. Obrigado!");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Explique o que aconteceu" required hint="Conte com suas palavras o motivo da sua ausência.">
        <TextArea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
        <p className="text-sm font-medium text-foreground">Os 5 porquês</p>
        <p className="text-xs text-foreground-subtle">
          Pergunte a si mesmo &quot;por quê?&quot; sobre o que aconteceu. Depois pergunte de novo, usando a resposta anterior, até
          chegar à causa principal. Se não chegar a 5, tudo bem: responda até onde der.
        </p>
        {whys.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-foreground-subtle">{i + 1}. Por quê?</span>
            <input
              value={w}
              onChange={(e) => setWhys((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} loading={pending}>
          {onBehalf ? "Salvar relato" : initial ? "Atualizar resposta" : "Enviar resposta"}
        </Button>
      </div>
    </div>
  );
}
