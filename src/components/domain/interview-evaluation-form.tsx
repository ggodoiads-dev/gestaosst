"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, YesNo, SelectNative, TextArea } from "@/components/domain/interview-fields";
import { concludeAbsenceInterviewAction } from "@/server/actions/absence-interview.actions";
import {
  ACTIONS_TAKEN,
  CLASSIFICATION_DETAILS,
  CLASSIFICATION_LABELS,
  HEALTH_PROBLEMS,
  type Classification,
  type Evaluation,
} from "@/domain/absence-interview/form";

type YN = "SIM" | "NAO" | "";

/** Parte B — avaliação da Gente/Liderança. Concluir marca a entrevista de ABS da falta como feita. */
export function InterviewEvaluationForm({ interviewId, initial }: { interviewId: string; initial: Evaluation | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [classification, setClassification] = useState<Classification | "">(initial?.classification ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [healthProblem, setHealth] = useState(initial?.healthProblem ?? "");
  const [actionTaken, setAction] = useState(initial?.actionTaken ?? "");
  const [excuseAccepted, setExcuse] = useState<YN>(initial?.excuseAccepted ?? "");
  const [dayDiscounted, setDiscounted] = useState<YN>(initial?.dayDiscounted ?? "");
  const [avoidable, setAvoidable] = useState<YN>(initial?.avoidableByDayOff ?? "");
  const [whys, setWhys] = useState<string[]>([0, 1, 2, 3, 4].map((i) => initial?.fiveWhys?.[i] ?? ""));
  const [hrComments, setHr] = useState(initial?.hrComments ?? "");
  const [leadershipComments, setLeadership] = useState(initial?.leadershipComments ?? "");

  const isHealthDetail = detail.startsWith("Saúde");

  function submit() {
    if (!classification) {
      toast.error("Escolha a classificação.");
      return;
    }
    if (!excuseAccepted || !dayDiscounted || !avoidable) {
      toast.error("Responda as três perguntas de Sim ou Não da ação tomada.");
      return;
    }
    startTransition(async () => {
      const res = await concludeAbsenceInterviewAction(interviewId, {
        classification,
        detail,
        healthProblem: isHealthDetail ? healthProblem || null : null,
        actionTaken,
        excuseAccepted,
        dayDiscounted,
        avoidableByDayOff: avoidable,
        fiveWhys: whys.filter((w) => w.trim()),
        hrComments: hrComments || null,
        leadershipComments: leadershipComments || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrevista concluída. A entrevista de ABS da falta foi marcada como feita.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Classificação da ausência" required>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CLASSIFICATION_LABELS) as Classification[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={classification === key}
              onClick={() => {
                setClassification(key);
                setDetail("");
              }}
              className={
                classification === key
                  ? "rounded-md border-2 border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-foreground"
                  : "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground-subtle hover:bg-surface-muted"
              }
            >
              {CLASSIFICATION_LABELS[key]}
            </button>
          ))}
        </div>
      </Field>

      {classification && (
        <Field label="Classificação detalhada" required>
          <SelectNative value={detail} onChange={setDetail} options={CLASSIFICATION_DETAILS[classification]} />
        </Field>
      )}
      {isHealthDetail && (
        <Field label="Problema de saúde relatado na entrevista">
          <SelectNative value={healthProblem} onChange={setHealth} options={HEALTH_PROBLEMS} />
        </Field>
      )}

      <Field label="Qual ação foi tomada, após a classificação da ausência?" required>
        <SelectNative value={actionTaken} onChange={setAction} options={ACTIONS_TAKEN} />
      </Field>
      <Field label="Justificativa para a falta acatada pela empresa?" required>
        <YesNo value={excuseAccepted} onChange={setExcuse} />
      </Field>
      <Field label="Dia de trabalho descontado?" required>
        <YesNo value={dayDiscounted} onChange={setDiscounted} />
      </Field>
      <Field label="A falta poderia ter sido evitada com uma folga alinhada?" required>
        <YesNo value={avoidable} onChange={setAvoidable} />
      </Field>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
        <p className="text-sm font-medium text-foreground">Análise dos 5 porquês (opcional)</p>
        <p className="text-xs text-foreground-subtle">
          Pergunte 5 vezes o porquê do problema, sempre com base na resposta anterior, até chegar à causa raiz.
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

      <Field label="Comentários adicionais — Gente e Gestão">
        <TextArea value={hrComments} onChange={(e) => setHr(e.target.value)} />
      </Field>
      <Field label="Comentários adicionais — Liderança">
        <TextArea value={leadershipComments} onChange={(e) => setLeadership(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button onClick={submit} loading={pending}>
          {initial ? "Atualizar e concluir" : "Concluir entrevista"}
        </Button>
      </div>
    </div>
  );
}
