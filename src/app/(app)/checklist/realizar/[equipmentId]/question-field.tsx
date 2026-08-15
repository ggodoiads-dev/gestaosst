"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FIXED_ANSWER_OPTIONS, NOT_APPLICABLE_VALUE } from "@/domain/checklist/answer-values";
import type { QuestionType } from "@/generated/prisma/enums";

type Option = { id: string; label: string; value: string };

export function QuestionField({
  type,
  options,
  allowNotApplicable,
  value,
  onChange,
}: {
  type: QuestionType;
  options: Option[];
  allowNotApplicable: boolean;
  value: string | null;
  onChange: (value: string) => void;
}) {
  const fixedOptions = FIXED_ANSWER_OPTIONS[type];

  if (fixedOptions || type === "SELECAO_UNICA" || type === "MULTIPLA_ESCOLHA") {
    const choiceOptions = fixedOptions ?? options.map((o) => ({ value: o.value, label: o.label }));
    return (
      <RadioGroup value={value ?? undefined} onValueChange={onChange} className="gap-2.5">
        {choiceOptions.map((opt) => (
          <label
            key={opt.value}
            className="flex items-center gap-3 rounded-md border border-border-strong px-4 py-3 text-sm cursor-pointer transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft"
          >
            <RadioGroupItem value={opt.value} />
            {opt.label}
          </label>
        ))}
        {allowNotApplicable && (
          <label className="flex items-center gap-3 rounded-md border border-border-strong px-4 py-3 text-sm cursor-pointer transition-colors has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft">
            <RadioGroupItem value={NOT_APPLICABLE_VALUE} />
            Não aplicável
          </label>
        )}
      </RadioGroup>
    );
  }

  if (type === "TEXTO_LONGO") {
    return <Textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (type === "NUMERO") {
    return (
      <Input type="number" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    );
  }

  if (type === "DATA") {
    return <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  // FOTO é tratada só pelo campo de anexo em checklist-runner.tsx — nunca preenche `value`,
  // então não tem campo de texto aqui (senão o obrigatório nunca fecharia por foto sozinha).
  if (type === "FOTO") return null;

  // TEXTO_CURTO, CONFIRMACAO caem aqui
  return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}
