"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, YesNo, SelectNative, TextInput, TextArea } from "@/components/domain/interview-fields";
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

const WITH_CERTIFICATE = "Saúde - com atestado Médico";

/** Parte B — o que o RH/Liderança responde: detalhamento, classificação e ação tomada. Concluir marca a entrevista de ABS da falta como feita. */
export function InterviewEvaluationForm({
  interviewId,
  initial,
  defaultDate,
}: {
  interviewId: string;
  initial: Evaluation | null;
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(initial?.endDate ?? defaultDate);
  const [prior, setPrior] = useState<YN>(initial?.priorUnjustified ?? "");
  const [communicated, setCommunicated] = useState<YN>(initial?.communicatedBefore ?? "");
  const [presented, setPresented] = useState<YN>(initial?.presentedJustification ?? "");
  const [classification, setClassification] = useState<Classification | "">(initial?.classification ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [healthProblem, setHealth] = useState(initial?.healthProblem ?? "");
  const [crm, setCrm] = useState(initial?.crm ?? "");
  const [cid, setCid] = useState(initial?.cid ?? "");
  const [actionTaken, setAction] = useState(initial?.actionTaken ?? "");
  const [excuseAccepted, setExcuse] = useState<YN>(initial?.excuseAccepted ?? "");
  const [dayDiscounted, setDiscounted] = useState<YN>(initial?.dayDiscounted ?? "");
  const [avoidable, setAvoidable] = useState<YN>(initial?.avoidableByDayOff ?? "");
  const [hrComments, setHr] = useState(initial?.hrComments ?? "");
  const [leadershipComments, setLeadership] = useState(initial?.leadershipComments ?? "");

  const isHealthDetail = detail.startsWith("Saúde");
  const hasCertificate = detail === WITH_CERTIFICATE;

  function submit() {
    if (!prior || !communicated || !presented) {
      toast.error("Responda as três perguntas do detalhamento da falta.");
      return;
    }
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
        startDate,
        endDate,
        priorUnjustified: prior,
        communicatedBefore: communicated,
        presentedJustification: presented,
        classification,
        detail,
        healthProblem: isHealthDetail ? healthProblem || null : null,
        crm: hasCertificate ? crm || null : null,
        cid: hasCertificate ? cid || null : null,
        actionTaken,
        excuseAccepted,
        dayDiscounted,
        avoidableByDayOff: avoidable,
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">2 — Detalhamento da(s) falta(s)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data de início da ausência" required>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Data final da ausência" required>
            <TextInput type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Ocorrência de falta(s) anterior(es) sem justificativa" required>
          <YesNo value={prior} onChange={setPrior} />
        </Field>
        <Field label="Comunicação prévia desta(s) falta(s) à empresa" required>
          <YesNo value={communicated} onChange={setCommunicated} />
        </Field>
        <Field label="Apresentação de justificativa compatível" required>
          <YesNo value={presented} onChange={setPresented} />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">3 — Classificação das faltas</h3>
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
          <Field label="Problema de saúde relatado pelo colaborador">
            <SelectNative value={healthProblem} onChange={setHealth} options={HEALTH_PROBLEMS} />
          </Field>
        )}
        {hasCertificate && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CRM do médico / CRO do dentista">
              <TextInput value={crm} onChange={(e) => setCrm(e.target.value)} />
            </Field>
            <Field label="CID do atestado" hint='Se o CID não foi informado, escreva "0".'>
              <TextInput value={cid} onChange={(e) => setCid(e.target.value)} />
            </Field>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">4 — Ação tomada</h3>
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
      </section>

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
