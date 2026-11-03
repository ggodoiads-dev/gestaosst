"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileDown, Gavel, Lock } from "lucide-react";
import { formatPersonName, initials } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { applyMeasureAction, dismissManyAction, dismissOccurrenceAction, freezeHistoryAction, recomputeCollaboratorsAction } from "@/server/actions/discipline.actions";
import { stepHasDocument } from "@/domain/discipline/document";
import {
  DISCIPLINE_STEPS,
  disciplineReasonLabel,
  disciplineStepLabel,
  type DisciplineReasonKey,
  type DisciplineStepKey,
} from "@/domain/discipline/ladder";

export type DisciplineEntry = {
  reason: DisciplineReasonKey;
  collaboratorId: string;
  collaboratorName: string;
  dayKey: string;
  suggestedStep: DisciplineStepKey;
  appliedCount: number;
  done?: number;
  required?: number;
};

function dmy(dayKey: string) {
  const [y, m, d] = dayKey.split("-");
  return `${d}/${m}/${y}`;
}

/** Aplicar a medida (padrão: a próxima da escada) ou dispensar com justificativa. */
export function MeasureDialog({ entry, mode, trigger }: { entry: DisciplineEntry; mode: "apply" | "dismiss"; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DisciplineStepKey>(entry.suggestedStep);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isApply = mode === "apply";

  function save() {
    setError(null);
    startTransition(async () => {
      const input = { reason: entry.reason, collaboratorId: entry.collaboratorId, dayKey: entry.dayKey, step, note };
      const res = isApply ? await applyMeasureAction(input) : await dismissOccurrenceAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const withDocument = isApply && res.id && stepHasDocument(step);
      toast.success(
        isApply ? `${disciplineStepLabel(step)} registrada.${withDocument ? " O documento para imprimir está sendo baixado." : ""}` : "Ocorrência dispensada.",
      );
      if (withDocument) window.location.assign(`/api/medidas-disciplinares/${res.id}/docx`);
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isApply ? "Registrar medida disciplinar" : "Dispensar ocorrência"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">{formatPersonName(entry.collaboratorName)}</p>
            <p className="text-xs text-foreground-subtle">
              {disciplineReasonLabel(entry.reason)} · {dmy(entry.dayKey)} · {entry.appliedCount} medida(s) já aplicada(s) por esse motivo
            </p>
          </div>
          {isApply ? (
            <FormField label="Medida" hint="Sugerida pela escada deste motivo — pode trocar se precisar">
              <Select value={step} onValueChange={(v) => setStep(v as DisciplineStepKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCIPLINE_STEPS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      {s.key === entry.suggestedStep ? " (sugerida)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <p className="text-foreground-subtle">Não gera medida e não avança a escada. O motivo fica registrado.{entry.reason === "FALTA" && " A falta deixa de contar como injustificada nos dias de benefício."}</p>
          )}
          <FormField label={isApply ? "Observação" : "Motivo da justificativa"} required={!isApply} hint={isApply ? "Opcional" : undefined}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </FormField>
          {isApply && stepHasDocument(step) && (
            <a
              href={`/api/medidas-disciplinares/previa?${new URLSearchParams({ reason: entry.reason, collaboratorId: entry.collaboratorId, dayKey: entry.dayKey, step, note }).toString()}`}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
            >
              <FileDown className="size-4" /> Baixar o documento para imprimir (sem registrar)
            </a>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>{isApply ? "Registrar" : "Dispensar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Checklist abaixo de 80% no dia → medida sugerida pela escada do checklist. */
export function DisciplineSection({ items }: { items: DisciplineEntry[] }) {
  const checklist = items.filter((i) => i.reason === "CHECKLIST");
  const groups = new Map<string, { name: string; id: string; items: DisciplineEntry[] }>();
  for (const i of checklist) {
    const g = groups.get(i.collaboratorId) ?? { name: i.collaboratorName, id: i.collaboratorId, items: [] };
    g.items.push(i);
    groups.set(i.collaboratorId, g);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gavel className="size-4" /> Checklist não realizado ({checklist.length})
          </h2>
          <p className="text-xs text-foreground-subtle">
            Entra quem fez menos de 80% do checklist no dia (80% ou mais = cumpriu). Cada motivo segue a sua escada: 1º DTO →
            2º DTO → advertência verbal → 1ª escrita → 2ª escrita → suspensão de 1 dia → suspensão de 3 dias → comitê.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {checklist.length > 0 && <RecomputeDialog name="" collaboratorIds={[...groups.keys()]} label="Refazer todos com o cadastro atual" />}
          <FreezeHistoryButton />
        </div>
      </div>

      {checklist.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-foreground-subtle">
          Nenhuma ocorrência de checklist pendente.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...groups.values()].map((g) => (
            <div key={g.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-soft text-xs font-semibold text-danger">{initials(g.name)}</span>
                <Link href={`/colaboradores/${g.id}`} className="text-sm font-semibold text-foreground hover:underline">
                  {formatPersonName(g.name)}
                </Link>
                <span className="text-xs text-foreground-subtle">{g.items.length} dia(s) abaixo de 80%</span>
                <span className="ml-auto flex items-center gap-2">
                  <RecomputeDialog name={g.name} collaboratorIds={[g.id]} />
                  <DismissAllDialog name={g.name} collaboratorId={g.id} dayKeys={g.items.map((i) => i.dayKey)} />
                </span>
              </div>
              <div className="divide-y divide-border">
                {g.items.map((item) => (
                  <div key={item.dayKey} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {dmy(item.dayKey)} — fez {item.done ?? 0} de {item.required ?? 0} equipamentos (
                        {item.required ? Math.round(((item.done ?? 0) / item.required) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-warning">Medida sugerida: {disciplineStepLabel(item.suggestedStep)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <MeasureDialog entry={item} mode="apply" trigger={<Button size="sm">Registrar medida</Button>} />
                      <MeasureDialog entry={item} mode="dismiss" trigger={<Button size="sm" variant="secondary">Dispensar</Button>} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Refaz os dias do colaborador com o cadastro de agora: para quando o cadastro (função/checklist obrigatório) estava errado e os dias já tinham sido travados com a exigência errada. */
function RecomputeDialog({ name, collaboratorIds, label = "Refazer com o cadastro atual" }: { name: string; collaboratorIds: string[]; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await recomputeCollaboratorsAction(collaboratorIds);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Dias refeitos: ${res.before ?? 0} ocorrência(s) antes, ${res.after ?? 0} agora.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="Refaz os dias com o cadastro de agora">
        {label}
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refazer os dias {collaboratorIds.length > 1 ? `de ${collaboratorIds.length} pessoas` : `de ${formatPersonName(name)}`}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 text-sm text-foreground-subtle">
          <p>
            Os dias (desde 20/10) são calculados de novo com o cadastro de hoje: equipamentos da área, checklist obrigatório da função, folgas e equipamentos bloqueados.
            Use depois de corrigir o cadastro, por exemplo quando a função não tinha o checklist obrigatório e a pessoa foi cobrada de todos os equipamentos da área.
          </p>
          <p>Medidas já aplicadas ou dispensadas não são mexidas. O que sobrar abaixo de 80% continua na lista.</p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending}>Refazer os dias</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dispensa de uma vez todos os dias listados de um colaborador, com uma justificativa. */
function DismissAllDialog({ name, collaboratorId, dayKeys }: { name: string; collaboratorId: string; dayKeys: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await dismissManyAction({ reason: "CHECKLIST", collaboratorId, dayKeys, note });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${res.count ?? dayKeys.length} ocorrência(s) dispensada(s).`);
      setOpen(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Dispensar todos ({dayKeys.length})
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dispensar {dayKeys.length} ocorrência(s)</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 text-sm">
          <p className="font-medium text-foreground">{formatPersonName(name)}</p>
          <p className="text-foreground-subtle">
            Todos os dias listados deste colaborador são dispensados: não geram medida e não avançam a escada. Cada dia fica registrado com a justificativa abaixo, e dá para desfazer um a um no histórico.
          </p>
          <FormField label="Motivo da justificativa" required>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex.: o cadastro do checklist estava errado nesses dias, a pessoa cumpriu o checklist dela." />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending} disabled={note.trim().length < 3}>Dispensar todos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trava o resultado dos dias de checklist já fechados: mudar equipamento de área ou checklist da função não cria mais ocorrência retroativa. */
function FreezeHistoryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function freeze() {
    if (!window.confirm("Travar o histórico? Os dias de checklist já fechados passam a valer como estão agora e não mudam mais se o cadastro mudar (equipamento de área, checklist da função). Confira antes que a lista de ocorrências está certa.")) return;
    startTransition(async () => {
      const res = await freezeHistoryAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count ?? 0} dia(s) travado(s).`);
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="ghost" onClick={freeze} loading={pending} title="Trava os dias já fechados">
      <Lock className="size-4" /> Travar histórico
    </Button>
  );
}
