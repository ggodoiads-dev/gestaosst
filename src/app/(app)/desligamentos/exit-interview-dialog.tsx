"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { loadExitInterviewAction, saveExitInterviewAction } from "@/server/actions/exit-interview.actions";
import type { ExitInterviewData } from "@/server/services/exit-interview.service";
import { EXIT_RATINGS, EXIT_REASONS, WOULD_RETURN, type ExitRatingKey } from "@/domain/termination/interview";

const inputCls = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";
const blank = (today: string): ExitInterviewData => ({ conductedAt: today, interviewer: "", primaryReason: "", secondaryReasons: [], ratings: {}, wouldReturn: "", destination: "", comments: "" });

/** Entrevista de desligamento de um colaborador (só RH). O motivo real e as notas alimentam o diagnóstico do PDCA do turnover. */
export function ExitInterviewDialog({ terminationId, name, done, today }: { terminationId: string; name: string; done: boolean; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExitInterviewData>(blank(today));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ExitInterviewData>) => setData((d) => ({ ...d, ...patch }));

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(null);
    setLoading(true);
    const found = await loadExitInterviewAction(terminationId).catch(() => null);
    setData(found ?? blank(today));
    setLoading(false);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await saveExitInterviewAction(terminationId, data);
      if (res.ok) {
        toast.success("Entrevista salva.");
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  const toggleSecondary = (key: string) =>
    set({ secondaryReasons: data.secondaryReasons.includes(key) ? data.secondaryReasons.filter((k) => k !== key) : [...data.secondaryReasons, key] });

  return (
    <Dialog open={open} onOpenChange={(v) => void onOpenChange(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant={done ? "ghost" : "secondary"}>
          <MessageSquareText className="size-4" /> {done ? "Ver entrevista" : "Registrar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrevista de desligamento — {name}</DialogTitle>
          <DialogDescription>Só o RH vê esta entrevista. O motivo principal, as notas e a intenção de voltar alimentam o diagnóstico do PDCA do turnover.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-foreground-subtle">Carregando…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Data da entrevista" required>
                  <input type="date" value={data.conductedAt} max={today} onChange={(e) => set({ conductedAt: e.target.value })} className={inputCls} />
                </FormField>
                <FormField label="Entrevistador">
                  <input value={data.interviewer} onChange={(e) => set({ interviewer: e.target.value })} className={inputCls} maxLength={120} />
                </FormField>
              </div>
              <FormField label="Motivo principal da saída" required>
                <select value={data.primaryReason} onChange={(e) => set({ primaryReason: e.target.value, secondaryReasons: data.secondaryReasons.filter((k) => k !== e.target.value) })} className={inputCls}>
                  <option value="">Escolher…</option>
                  {EXIT_REASONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </FormField>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-foreground-muted">Outros fatores que pesaram (até 5)</span>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {EXIT_REASONS.filter((r) => r.key !== data.primaryReason).map((r) => (
                    <label key={r.key} className="flex items-center gap-2 text-sm text-foreground-muted">
                      <input type="checkbox" checked={data.secondaryReasons.includes(r.key)} onChange={() => toggleSecondary(r.key)} disabled={!data.secondaryReasons.includes(r.key) && data.secondaryReasons.length >= 5} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-foreground-muted">Como avalia (1 muito ruim a 5 muito bom)</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EXIT_RATINGS.map((r) => (
                    <label key={r.key} className="flex items-center justify-between gap-2 text-sm text-foreground-muted">
                      {r.label}
                      <select value={data.ratings[r.key as ExitRatingKey] ?? ""} onChange={(e) => set({ ratings: { ...data.ratings, [r.key]: e.target.value === "" ? undefined : Number(e.target.value) } })} className="h-8 w-20 rounded-md border border-border-strong bg-surface px-1 text-sm text-foreground">
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Voltaria a trabalhar aqui?">
                  <select value={data.wouldReturn} onChange={(e) => set({ wouldReturn: e.target.value })} className={inputCls}>
                    <option value="">Não respondeu</option>
                    {WOULD_RETURN.map((w) => (
                      <option key={w.key} value={w.key}>{w.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Para onde vai (empresa ou segmento)">
                  <input value={data.destination} onChange={(e) => set({ destination: e.target.value })} className={inputCls} maxLength={200} />
                </FormField>
              </div>
              <FormField label="O que o colaborador disse (resumo)">
                <Textarea rows={4} value={data.comments} onChange={(e) => set({ comments: e.target.value })} maxLength={2000} />
              </FormField>
            </>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={submit} loading={pending} disabled={loading || !data.primaryReason}>
            Salvar entrevista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
