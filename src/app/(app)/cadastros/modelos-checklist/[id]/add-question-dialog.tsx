"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { addQuestionAction, type ActionResult } from "@/server/actions/checklist-template.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import {
  FIXED_ANSWER_OPTIONS,
  QUESTION_TYPE_LABELS,
  questionHasFixedOptions,
  questionUsesCustomOptions,
} from "@/domain/checklist/answer-values";
import type { FaultCategory } from "@/generated/prisma/client";
import type { QuestionType } from "@/generated/prisma/enums";

const initialState: ActionResult = { ok: true };

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

const SEVERITY_OPTIONS = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

export function AddQuestionDialog({
  templateId,
  versionId,
  faultCategories,
}: {
  templateId: string;
  versionId: string;
  faultCategories: FaultCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addQuestionAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  const [type, setType] = useState<QuestionType>("CONFORME_NAO_CONFORME");
  const [required, setRequired] = useState(true);
  const [allowNA, setAllowNA] = useState(false);
  const [customOptions, setCustomOptions] = useState<{ label: string; value: string }[]>([
    { label: "", value: "" },
  ]);

  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [triggerValue, setTriggerValue] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [requiresComment, setRequiresComment] = useState(true);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [createsNC, setCreatesNC] = useState(true);
  const [blocksEquipment, setBlocksEquipment] = useState(false);
  const [severity, setSeverity] = useState("MEDIA");
  const [faultCategoryId, setFaultCategoryId] = useState<string>("none");

  const hasFixed = questionHasFixedOptions(type);
  const hasCustom = questionUsesCustomOptions(type);
  const canHaveRule = hasFixed || hasCustom;

  const triggerCandidates = useMemo(() => {
    if (hasFixed) return FIXED_ANSWER_OPTIONS[type] ?? [];
    if (hasCustom) return customOptions.filter((o) => o.value.trim());
    return [];
  }, [hasFixed, hasCustom, type, customOptions]);

  const optionsJson =
    hasCustom
      ? JSON.stringify(customOptions.filter((o) => o.label.trim() && o.value.trim()))
      : "";

  const ruleJson =
    ruleEnabled && canHaveRule && triggerValue
      ? JSON.stringify({
          triggerValue,
          isCritical,
          requiresComment,
          requiresPhoto,
          createsNonconformity: createsNC,
          blocksEquipment,
          severity,
          faultCategoryId: faultCategoryId === "none" ? null : faultCategoryId,
        })
      : "";

  function updateCustomOption(index: number, field: "label" | "value", value: string) {
    setCustomOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Adicionar pergunta
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="versionId" value={versionId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="required" value={required ? "on" : ""} />
          <input type="hidden" name="allowNotApplicable" value={allowNA ? "on" : ""} />
          {optionsJson && <input type="hidden" name="optionsJson" value={optionsJson} />}
          {ruleJson && <input type="hidden" name="ruleJson" value={ruleJson} />}

          <DialogBody className="flex flex-col gap-4">
            <FormField label="Texto da pergunta" htmlFor="title" required>
              <Input id="title" name="title" required placeholder="Ex: Sistema de frenagem está funcionando?" />
            </FormField>

            <FormField label="Descrição / orientação ao colaborador" htmlFor="guidance">
              <Textarea id="guidance" name="guidance" rows={2} />
            </FormField>

            <FormField label="Tipo de resposta" required>
              <Select value={type} onValueChange={(v) => { setType(v as QuestionType); setRuleEnabled(false); setTriggerValue(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-foreground-muted">
                <Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />
                Obrigatória
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground-muted">
                <Checkbox checked={allowNA} onCheckedChange={(v) => setAllowNA(v === true)} />
                Permite &quot;Não aplicável&quot;
              </label>
            </div>

            {hasCustom && (
              <div className="flex flex-col gap-2">
                <Label>Opções de resposta</Label>
                {customOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Texto da opção"
                      value={opt.label}
                      onChange={(e) => {
                        updateCustomOption(idx, "label", e.target.value);
                        updateCustomOption(idx, "value", e.target.value.trim().toUpperCase().replace(/\s+/g, "_"));
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCustomOptions((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={customOptions.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  onClick={() => setCustomOptions((prev) => [...prev, { label: "", value: "" }])}
                >
                  <Plus /> Adicionar opção
                </Button>
              </div>
            )}

            {canHaveRule && (
              <>
                <Separator />
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox checked={ruleEnabled} onCheckedChange={(v) => setRuleEnabled(v === true)} />
                  Esta pergunta pode gerar um desvio
                </label>

                {ruleEnabled && (
                  <div className="flex flex-col gap-4 rounded-md border border-border p-3.5 bg-surface-muted">
                    <FormField label="Resposta que caracteriza desvio" required>
                      <Select value={triggerValue} onValueChange={setTriggerValue}>
                        <SelectTrigger><SelectValue placeholder="Selecione a resposta" /></SelectTrigger>
                        <SelectContent>
                          {triggerCandidates.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Checkbox checked={isCritical} onCheckedChange={(v) => setIsCritical(v === true)} />
                        Pergunta crítica
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Checkbox checked={requiresComment} onCheckedChange={(v) => setRequiresComment(v === true)} />
                        Exige comentário
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Checkbox checked={requiresPhoto} onCheckedChange={(v) => setRequiresPhoto(v === true)} />
                        Exige foto
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Checkbox checked={createsNC} onCheckedChange={(v) => setCreatesNC(v === true)} />
                        Gera não conformidade
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-muted">
                        <Checkbox checked={blocksEquipment} onCheckedChange={(v) => setBlocksEquipment(v === true)} />
                        Bloqueia o equipamento
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Severidade">
                        <Select value={severity} onValueChange={setSeverity}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SEVERITY_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                      <FormField label="Categoria da falha">
                        <Select value={faultCategoryId} onValueChange={setFaultCategoryId}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem categoria</SelectItem>
                            {faultCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    </div>
                  </div>
                )}
              </>
            )}

            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
