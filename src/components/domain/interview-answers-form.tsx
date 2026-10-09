"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, YesNo, SelectNative, TextInput, TextArea } from "@/components/domain/interview-fields";
import { submitAbsenceInterviewAnswersAction } from "@/server/actions/absence-interview.actions";
import {
  EMPLOYEE_REASONS,
  HEALTH_PROBLEMS,
  REASON_IS_HEALTH,
  REASON_HAS_CERTIFICATE,
  type EmployeeAnswers,
} from "@/domain/absence-interview/form";

type YN = "SIM" | "NAO" | "";

/** Parte A — relato do colaborador (ou do RH, preenchendo por quem não tem login). */
export function InterviewAnswersForm({
  interviewId,
  initial,
  defaultDate,
  onBehalf,
}: {
  interviewId: string;
  initial: EmployeeAnswers | null;
  defaultDate: string;
  onBehalf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(initial?.endDate ?? defaultDate);
  const [priorUnjustified, setPrior] = useState<YN>(initial?.priorUnjustified ?? "");
  const [communicatedBefore, setComm] = useState<YN>(initial?.communicatedBefore ?? "");
  const [presentedJustification, setPres] = useState<YN>(initial?.presentedJustification ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [healthProblem, setHealth] = useState(initial?.healthProblem ?? "");
  const [crm, setCrm] = useState(initial?.crm ?? "");
  const [cid, setCid] = useState(initial?.cid ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [comments, setComments] = useState(initial?.comments ?? "");

  function submit() {
    if (!priorUnjustified || !communicatedBefore || !presentedJustification) {
      toast.error("Responda as três perguntas de Sim ou Não.");
      return;
    }
    startTransition(async () => {
      const res = await submitAbsenceInterviewAnswersAction(interviewId, {
        startDate,
        endDate,
        priorUnjustified,
        communicatedBefore,
        presentedJustification,
        reason,
        healthProblem: REASON_IS_HEALTH(reason) ? healthProblem || null : null,
        crm: REASON_HAS_CERTIFICATE(reason) ? crm || null : null,
        cid: REASON_HAS_CERTIFICATE(reason) ? cid || null : null,
        description,
        comments: comments || null,
      });
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data de início da ausência" required>
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Data final da ausência" required>
          <TextInput type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Teve falta(s) anterior(es) sem justificativa?" required>
        <YesNo value={priorUnjustified} onChange={setPrior} />
      </Field>
      <Field label="Você avisou a empresa antes dessa(s) falta(s)?" required>
        <YesNo value={communicatedBefore} onChange={setComm} />
      </Field>
      <Field label="Apresentou justificativa (atestado, comprovante)?" required>
        <YesNo value={presentedJustification} onChange={setPres} />
      </Field>

      <Field label="Qual foi o motivo principal da ausência?" required>
        <SelectNative value={reason} onChange={setReason} options={EMPLOYEE_REASONS} />
      </Field>

      {REASON_IS_HEALTH(reason) && (
        <Field label="Qual foi o problema de saúde?">
          <SelectNative value={healthProblem} onChange={setHealth} options={HEALTH_PROBLEMS} />
        </Field>
      )}

      {REASON_HAS_CERTIFICATE(reason) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CRM do médico / CRO do dentista">
            <TextInput value={crm} onChange={(e) => setCrm(e.target.value)} />
          </Field>
          <Field label="CID do atestado" hint='Se o CID não foi informado, escreva "0".'>
            <TextInput value={cid} onChange={(e) => setCid(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Explique com suas palavras o que aconteceu" required>
        <TextArea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Field label="Quer acrescentar mais alguma coisa? (opcional)">
        <TextArea value={comments} onChange={(e) => setComments(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button onClick={submit} loading={pending}>
          {onBehalf ? "Salvar relato" : initial ? "Atualizar resposta" : "Enviar resposta"}
        </Button>
      </div>
    </div>
  );
}
