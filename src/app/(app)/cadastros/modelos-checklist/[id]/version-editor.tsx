"use client";

import { useState, useTransition } from "react";
import { Trash2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VersionStatusBadge } from "@/components/domain/status-badges";
import { AddQuestionDialog } from "./add-question-dialog";
import {
  publishVersionAction,
  removeQuestionAction,
  updateVersionPeriodicityAction,
} from "@/server/actions/checklist-template.actions";
import { QUESTION_TYPE_LABELS } from "@/domain/checklist/answer-values";
import { toast } from "sonner";
import type { FaultCategory } from "@/generated/prisma/client";

const PERIODICITY_OPTIONS = [
  { value: "POR_TURNO", label: "Por turno" },
  { value: "DIARIO", label: "Diário" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSAL", label: "Mensal" },
  { value: "ANTES_DO_USO", label: "Antes do uso" },
  { value: "DEPOIS_DO_USO", label: "Depois do uso" },
  { value: "PERSONALIZADO", label: "Personalizado" },
];

type QuestionWithRules = {
  id: string;
  order: number;
  title: string;
  type: string;
  required: boolean;
  rules: {
    isCritical: boolean;
    createsNonconformity: boolean;
    blocksEquipment: boolean;
    triggerValue: string;
  }[];
};

export function VersionEditor({
  templateId,
  version,
  faultCategories,
}: {
  templateId: string;
  version: {
    id: string;
    versionNumber: number;
    status: string;
    periodicity: string;
    questions: QuestionWithRules[];
  };
  faultCategories: FaultCategory[];
}) {
  const [periodicity, setPeriodicity] = useState(version.periodicity);
  const [isPending, startTransition] = useTransition();
  const isDraft = version.status === "RASCUNHO";

  function handlePeriodicityChange(value: string) {
    setPeriodicity(value);
    startTransition(async () => {
      await updateVersionPeriodicityAction(templateId, version.id, value);
    });
  }

  function handlePublish() {
    startTransition(async () => {
      await publishVersionAction(templateId, version.id);
      toast.success(`Versão ${version.versionNumber} publicada e ativada.`);
    });
  }

  function handleRemoveQuestion(questionId: string) {
    startTransition(async () => {
      await removeQuestionAction(templateId, questionId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Versão {version.versionNumber}</span>
          <VersionStatusBadge status={version.status as never} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-subtle">Periodicidade</span>
          <Select value={periodicity} onValueChange={handlePeriodicityChange} disabled={!isDraft}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODICITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isDraft && (
            <Button size="sm" onClick={handlePublish} loading={isPending}>
              <Rocket /> Publicar versão
            </Button>
          )}
        </div>
      </div>

      {isDraft && (
        <div>
          <AddQuestionDialog templateId={templateId} versionId={version.id} faultCategories={faultCategories} />
        </div>
      )}

      <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
        {version.questions.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-foreground-subtle">
            Nenhuma pergunta cadastrada nesta versão.
          </p>
        )}
        {version.questions.map((q) => {
          const rule = q.rules[0];
          return (
            <div key={q.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-foreground-subtle">{q.order}.</span>
                  <span className="text-sm font-medium text-foreground">{q.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-5">
                  <Badge tone="neutral">{QUESTION_TYPE_LABELS[q.type as keyof typeof QUESTION_TYPE_LABELS]}</Badge>
                  {q.required && <Badge tone="neutral">Obrigatória</Badge>}
                  {rule?.isCritical && <Badge tone="danger">Crítica</Badge>}
                  {rule?.createsNonconformity && <Badge tone="warning">Gera NC</Badge>}
                  {rule?.blocksEquipment && <Badge tone="danger">Bloqueia equipamento</Badge>}
                </div>
              </div>
              {isDraft && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover pergunta"
                  onClick={() => handleRemoveQuestion(q.id)}
                  disabled={isPending}
                >
                  <Trash2 className="size-4 text-danger" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
