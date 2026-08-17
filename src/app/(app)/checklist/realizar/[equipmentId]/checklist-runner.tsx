"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Camera, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { QuestionField } from "./question-field";
import { AiFindingCard } from "./ai-finding-card";
import {
  saveAnswerAction,
  uploadAnswerPhotoAction,
  finalizeExecutionAction,
} from "@/server/actions/checklist-execution.actions";
import { NOT_APPLICABLE_VALUE } from "@/domain/checklist/answer-values";
import { compressImage } from "@/lib/compress-image";
import { useRico } from "@/components/rico/rico-context";
import type { QuestionType, Criticality } from "@/generated/prisma/enums";

type RuleSummary = { triggerValue: string; requiresComment: boolean; requiresPhoto: boolean };
type OptionData = { id: string; label: string; value: string };

export type RunnerQuestion = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  guidance: string | null;
  type: QuestionType;
  required: boolean;
  allowNotApplicable: boolean;
  options: OptionData[];
  rules: RuleSummary[];
};

export type AiFinding = {
  severity: Criticality;
  summary: string;
  suggestedAction: string | null;
};

export type RunnerAnswer = {
  value: string | null;
  comment: string | null;
  photoUrl: string | null;
  aiFinding?: AiFinding | null;
};

export function ChecklistRunner({
  equipmentId,
  equipmentCode,
  equipmentName,
  equipmentPhotoUrl,
  executionId,
  questions,
  initialAnswers,
}: {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentPhotoUrl: string | null;
  executionId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, RunnerAnswer>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, RunnerAnswer>>(initialAnswers);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [finalizing, startFinalize] = useTransition();
  const [issues, setIssues] = useState<{ questionId: string; questionTitle: string; reason: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = questions[index];
  const answer = answers[question.id] ?? { value: null, comment: null, photoUrl: null };

  const activeRule = useMemo(
    () => question.rules.find((r) => r.triggerValue === answer.value),
    [question, answer.value],
  );

  const { notifyContext } = useRico();

  useEffect(() => {
    if (!activeRule || answer.value === NOT_APPLICABLE_VALUE) return;
    if (!(activeRule.requiresComment || activeRule.requiresPhoto)) return;
    notifyContext({
      kind: "checklist_deviation",
      equipmentCode,
      questionTitle: question.title,
      answerValue: answer.value ?? "",
    });
  }, [activeRule, answer.value, equipmentCode, question.title, notifyContext]);

  const isLast = index === questions.length - 1;
  const progressPct = Math.round(((index + 1) / questions.length) * 100);

  function persistAnswer(questionId: string, value: string | null, comment: string | null) {
    void saveAnswerAction(executionId, questionId, value, comment);
  }

  function updateAnswer(patch: Partial<RunnerAnswer>) {
    setAnswers((prev) => {
      const next = { ...prev, [question.id]: { ...answer, ...patch } };
      return next;
    });
  }

  function handleValueChange(value: string) {
    updateAnswer({ value });
    persistAnswer(question.id, value, answer.comment);
  }

  function handleCommentChange(comment: string) {
    updateAnswer({ comment });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistAnswer(question.id, answer.value, comment);
    }, 500);
  }

  async function handlePhotoSelected(file: File) {
    setSavingPhoto(true);
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    const result = await uploadAnswerPhotoAction(executionId, question.id, question.title, formData);
    setSavingPhoto(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    updateAnswer({ photoUrl: URL.createObjectURL(file), aiFinding: result.finding });
    toast.success("Foto anexada.");
  }

  function goNext() {
    if (!isLast) setIndex((i) => i + 1);
  }
  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  function handleFinalize() {
    startFinalize(async () => {
      const answersPayload = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id]?.value ?? null,
        comment: answers[q.id]?.comment ?? null,
      }));
      const result = await finalizeExecutionAction(equipmentId, executionId, answersPayload);
      if (!result.ok) {
        setIssues(result.issues);
        const firstIssueIndex = questions.findIndex((q) => q.id === result.issues[0]?.questionId);
        if (firstIssueIndex >= 0) setIndex(firstIssueIndex);
        toast.error("Existem pendências antes de finalizar o checklist.");
        return;
      }
      setIssues([]);
      setCompleted(true);
    });
  }

  if (completed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Checklist finalizado</h1>
          <p className="mt-1 text-sm text-foreground-subtle">
            {equipmentCode} — {equipmentName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/checklist/realizar")}>
            Voltar à lista
          </Button>
          <Button onClick={() => router.push(`/equipamentos/${equipmentId}`)}>Ver equipamento</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between text-xs text-foreground-subtle mb-2">
          <span className="flex items-center gap-2">
            {equipmentPhotoUrl && (
              <a
                href={equipmentPhotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver foto do equipamento em tamanho maior"
                className="shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads */}
                <img
                  src={equipmentPhotoUrl}
                  alt={`Foto de ${equipmentCode}`}
                  className="size-7 rounded object-cover border border-border hover:opacity-80 transition-opacity"
                />
              </a>
            )}
            {equipmentCode} — {equipmentName}
          </span>
          <span>Pergunta {index + 1} de {questions.length}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-soft overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 max-w-xl w-full mx-auto flex flex-col gap-5">
        {issues.length > 0 && (
          <div className="rounded-md border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger flex gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Corrija antes de finalizar:</p>
              <ul className="mt-1 list-disc pl-4">
                {issues.map((issue, i) => (
                  <li key={i}>{issue.questionTitle}: {issue.reason}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-base font-semibold text-foreground leading-snug">{question.title}</h2>
          {question.description && (
            <p className="mt-1 text-sm text-foreground-subtle">{question.description}</p>
          )}
          {question.guidance && (
            <p className="mt-2 rounded-md bg-info-soft px-3 py-2 text-xs text-info">{question.guidance}</p>
          )}
        </div>

        <QuestionField
          type={question.type}
          options={question.options}
          allowNotApplicable={question.allowNotApplicable}
          value={answer.value}
          onChange={handleValueChange}
        />

        {answer.value !== NOT_APPLICABLE_VALUE && activeRule?.requiresComment && (
          <div className="flex flex-col gap-1.5">
            <Label required>Comentário</Label>
            <Textarea
              rows={3}
              placeholder="Descreva o que foi observado"
              value={answer.comment ?? ""}
              onChange={(e) => handleCommentChange(e.target.value)}
            />
          </div>
        )}

        {answer.value !== NOT_APPLICABLE_VALUE && (activeRule?.requiresPhoto || question.type === "FOTO") && (
          <div className="flex flex-col gap-1.5">
            <Label required={activeRule?.requiresPhoto}>Foto</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoSelected(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-6 text-sm text-foreground-muted hover:bg-neutral-soft transition-colors"
            >
              {savingPhoto ? (
                <Loader2 className="size-4 animate-spin" />
              ) : answer.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pré-visualização via blob:/API local, next/image não se aplica
                <img src={answer.photoUrl} alt="Foto anexada" className="h-20 rounded-md object-cover" />
              ) : (
                <>
                  <Camera className="size-4" /> Tirar ou anexar foto
                </>
              )}
            </button>
            {answer.aiFinding && <AiFindingCard finding={answer.aiFinding} />}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 sm:px-6">
        <Button variant="secondary" onClick={goPrev} disabled={index === 0}>
          <ChevronLeft /> Anterior
        </Button>
        {isLast ? (
          <Button onClick={handleFinalize} loading={finalizing}>
            Finalizar checklist
          </Button>
        ) : (
          <Button onClick={goNext}>
            Próxima <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}
