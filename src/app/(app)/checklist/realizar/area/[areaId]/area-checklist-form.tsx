"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import {
  saveAnswerAction,
  uploadAnswerPhotoAction,
  finalizeExecutionAction,
} from "@/server/actions/checklist-execution.actions";
import { FIXED_ANSWER_OPTIONS, NOT_APPLICABLE_VALUE } from "@/domain/checklist/answer-values";
import { compressImage } from "@/lib/compress-image";

export type AreaChecklistItemData = {
  equipmentId: string;
  code: string;
  name: string;
  executionId: string;
  finished: boolean;
  initialValue: string | null;
  initialComment: string | null;
  hasPhoto: boolean;
};

type RuleSummary = { triggerValue: string; requiresComment: boolean; requiresPhoto: boolean };

type RowState = { value: string | null; comment: string | null; hasPhoto: boolean; uploadingPhoto: boolean };

const CONFORME_OPTIONS = FIXED_ANSWER_OPTIONS.CONFORME_NAO_CONFORME!;

export function AreaChecklistForm({
  areaName,
  questionId,
  questionTitle,
  allowNotApplicable,
  rules,
  items,
}: {
  areaName: string;
  questionId: string;
  questionTitle: string;
  allowNotApplicable: boolean;
  rules: RuleSummary[];
  items: AreaChecklistItemData[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.equipmentId,
        { value: item.initialValue, comment: item.initialComment, hasPhoto: item.hasPhoto, uploadingPhoto: false },
      ]),
    ),
  );
  const [rowIssues, setRowIssues] = useState<Record<string, string>>({});
  const [finalizing, startFinalize] = useTransition();
  const commentTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const totalCount = items.length;
  const finishedCount = items.filter((i) => i.finished).length;

  function updateRow(equipmentId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [equipmentId]: { ...prev[equipmentId], ...patch } }));
  }

  function handleValueChange(item: AreaChecklistItemData, value: string) {
    updateRow(item.equipmentId, { value });
    void saveAnswerAction(item.executionId, questionId, value, rows[item.equipmentId]?.comment ?? null);
  }

  function handleCommentChange(item: AreaChecklistItemData, comment: string) {
    updateRow(item.equipmentId, { comment });
    if (commentTimers.current[item.equipmentId]) clearTimeout(commentTimers.current[item.equipmentId]);
    commentTimers.current[item.equipmentId] = setTimeout(() => {
      void saveAnswerAction(item.executionId, questionId, rows[item.equipmentId]?.value ?? null, comment);
    }, 500);
  }

  async function handlePhotoSelected(item: AreaChecklistItemData, file: File) {
    updateRow(item.equipmentId, { uploadingPhoto: true });
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    const result = await uploadAnswerPhotoAction(item.executionId, questionId, questionTitle, formData);
    updateRow(item.equipmentId, { uploadingPhoto: false });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    updateRow(item.equipmentId, { hasPhoto: true });
    toast.success(`Foto anexada — ${item.code}.`);
  }

  function handleFinalize() {
    startFinalize(async () => {
      const toSubmit = items.filter((item) => !item.finished && rows[item.equipmentId]?.value);
      if (toSubmit.length === 0) {
        toast.error("Marque pelo menos um equipamento antes de finalizar.");
        return;
      }

      const nextIssues: Record<string, string> = {};
      let okCount = 0;

      await Promise.all(
        toSubmit.map(async (item) => {
          const row = rows[item.equipmentId];
          const result = await finalizeExecutionAction(item.equipmentId, item.executionId, [
            { questionId, value: row.value, comment: row.comment },
          ]);
          if (result.ok) {
            okCount++;
          } else {
            nextIssues[item.equipmentId] = result.issues[0]?.reason ?? "Pendência não identificada.";
          }
        }),
      );

      setRowIssues(nextIssues);
      if (okCount > 0) toast.success(`${okCount} equipamento${okCount === 1 ? "" : "s"} finalizado${okCount === 1 ? "" : "s"}.`);
      if (Object.keys(nextIssues).length > 0) {
        toast.error("Alguns equipamentos ficaram pendentes — confira abaixo.");
      } else {
        router.push("/checklist/realizar");
        router.refresh();
      }
    });
  }

  return (
    <>
      <PageHeader title={`Checklist — ${areaName}`} description={questionTitle} />
      <PageBody>
        <div className="mb-4 flex items-center gap-2 text-sm text-foreground-subtle">
          <span>{finishedCount} de {totalCount} equipamentos concluídos hoje</span>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const row = rows[item.equipmentId];
            const activeRule = rules.find((r) => r.triggerValue === row.value);
            const showExtra = row.value && row.value !== NOT_APPLICABLE_VALUE && activeRule;
            const issue = rowIssues[item.equipmentId];

            return (
              <div
                key={item.equipmentId}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.code} — {item.name}</p>
                  </div>
                  {item.finished && <Badge tone="success" dot>Concluído</Badge>}
                </div>

                {!item.finished && (
                  <div className="flex flex-col gap-3">
                    <RadioGroup
                      value={row.value ?? undefined}
                      onValueChange={(v) => handleValueChange(item, v)}
                      className="flex flex-wrap gap-2.5"
                    >
                      {CONFORME_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-md border border-border-strong px-3.5 py-2 text-sm cursor-pointer transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft"
                        >
                          <RadioGroupItem value={opt.value} />
                          {opt.label}
                        </label>
                      ))}
                      {allowNotApplicable && (
                        <label className="flex items-center gap-2 rounded-md border border-border-strong px-3.5 py-2 text-sm cursor-pointer transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft">
                          <RadioGroupItem value={NOT_APPLICABLE_VALUE} />
                          N/A
                        </label>
                      )}
                    </RadioGroup>

                    {showExtra && activeRule?.requiresComment && (
                      <div className="flex flex-col gap-1.5">
                        <Label required>Observação</Label>
                        <Textarea
                          rows={2}
                          placeholder="Descreva o que foi observado"
                          value={row.comment ?? ""}
                          onChange={(e) => handleCommentChange(item, e.target.value)}
                        />
                      </div>
                    )}

                    {showExtra && activeRule?.requiresPhoto && (
                      <div className="flex flex-col gap-1.5">
                        <Label required>Foto</Label>
                        <PhotoPicker
                          uploading={row.uploadingPhoto}
                          hasPhoto={row.hasPhoto}
                          onSelect={(file) => void handlePhotoSelected(item, file)}
                        />
                      </div>
                    )}

                    {issue && <p className="text-xs text-danger">{issue}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleFinalize} loading={finalizing}>
            <CheckCircle2 className="size-4" /> Finalizar checklist da área
          </Button>
        </div>
      </PageBody>
    </>
  );
}

function PhotoPicker({
  uploading,
  hasPhoto,
  onSelect,
}: {
  uploading: boolean;
  hasPhoto: boolean;
  onSelect: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-muted px-4 py-3 text-sm text-foreground-muted hover:bg-neutral-soft transition-colors"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : hasPhoto ? (
          <span className="text-success">Foto anexada</span>
        ) : (
          <>
            <Camera className="size-4" /> Tirar ou anexar foto
          </>
        )}
      </button>
    </>
  );
}
