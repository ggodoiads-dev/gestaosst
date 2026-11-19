"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { stopDpvimSessionAction } from "@/server/actions/dpvim.actions";

function toInt(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.NaN;
}

export type StopLine = { kind: string; label: string; expected: number };

type Fields = { qty: string; good: string; transfer: string; discard: string };
const EMPTY: Fields = { qty: "", good: "", transfer: "", discard: "" };

/**
 * Parar a atividade: para cada produto da DPVIM, quanto os ajudantes contaram e, desses, quantos foram bons, transferência e descarte.
 * O "norte" do conferente aparece só como referência: dá para contar mais ou menos do que ele.
 */
export function StopDpvimDialog({ sessionId, code, lines }: { sessionId: string; code: string; lines: StopLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<Record<string, Fields>>({});
  const [notes, setNotes] = useState("");
  const [finish, setFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = (kind: string): Fields => fields[kind] ?? EMPTY;
  const set = (kind: string, patch: Partial<Fields>) => setFields((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? EMPTY), ...patch } }));

  const parsed = lines.map((l) => {
    const f = get(l.kind);
    const qty = toInt(f.qty);
    const good = toInt(f.good);
    const transfer = toInt(f.transfer);
    const discard = toInt(f.discard);
    const numbersOk = [qty, good, transfer, discard].every((v) => v === null || (Number.isInteger(v) && v >= 0));
    const split = (good ?? 0) + (transfer ?? 0) + (discard ?? 0);
    const anySplit = good !== null || transfer !== null || discard !== null;
    return { line: l, qty, good, transfer, discard, numbersOk, split, anySplit, over: anySplit && split > (qty ?? 0) };
  });
  // Cada produto pode ficar em branco (= 0), mas o que for digitado tem que ser um número inteiro; ao menos um precisa ter número; e a divisão não pode passar do contado.
  const valid = parsed.every((p) => p.numbersOk && !p.over) && parsed.some((p) => p.qty !== null);
  const total = parsed.reduce((s, p) => s + (p.qty ?? 0), 0);

  function submit() {
    if (!valid) return;
    setError(null);
    start(async () => {
      const res = await stopDpvimSessionAction(sessionId, {
        items: parsed.map((p) => ({ kind: p.line.kind, qty: p.qty ?? 0, good: p.good, transfer: p.transfer, discard: p.discard })),
        notes,
        finish,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.concluded ? `${code} concluída!` : "Atividade parada. Quantidade registrada.");
      setOpen(false);
      setFields({});
      setNotes("");
      setFinish(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          <Square className="size-4" /> Parar atividade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Parar {code}</DialogTitle>
          <DialogDescription>
            Para cada produto, informe quanto vocês contaram e, desses, quantos foram bons, transferência e descarte. O norte do conferente é só uma referência, não um limite.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {parsed.map((p) => {
            const f = get(p.line.kind);
            return (
              <div key={p.line.kind} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <FormField label={`Quantos de ${p.line.label} foram contados`} required={lines.length === 1} hint={p.line.expected > 0 ? `Norte do conferente: ${p.line.expected}` : "O conferente ainda não contou esta carga"}>
                  <Input value={f.qty} onChange={(e) => set(p.line.kind, { qty: e.target.value })} inputMode="numeric" placeholder="0" className="tabular-nums" />
                </FormField>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Bons">
                    <Input value={f.good} onChange={(e) => set(p.line.kind, { good: e.target.value })} inputMode="numeric" className="tabular-nums" aria-label={`Bons de ${p.line.label}`} />
                  </FormField>
                  <FormField label="Transferência">
                    <Input value={f.transfer} onChange={(e) => set(p.line.kind, { transfer: e.target.value })} inputMode="numeric" className="tabular-nums" aria-label={`Transferência de ${p.line.label}`} />
                  </FormField>
                  <FormField label="Descarte">
                    <Input value={f.discard} onChange={(e) => set(p.line.kind, { discard: e.target.value })} inputMode="numeric" className="tabular-nums" aria-label={`Descarte de ${p.line.label}`} />
                  </FormField>
                </div>
                {p.over && <p className="text-xs text-danger">Bons + transferência + descarte ({p.split}) passam do que foi contado de {p.line.label} ({p.qty ?? 0}).</p>}
                {!p.over && p.anySplit && p.split < (p.qty ?? 0) && (
                  <p className="text-xs text-warning">
                    Faltam {(p.qty ?? 0) - p.split} de {p.line.label} para dividir entre bons, transferência e descarte.
                  </p>
                )}
              </div>
            );
          })}
          {lines.length > 1 && <p className="text-xs tabular-nums text-foreground-subtle">Total contado nesta atividade: {total}</p>}
          <FormField label="Observação" hint="Opcional">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </FormField>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox checked={finish} onCheckedChange={(v) => setFinish(v === true)} />
            Terminamos esta DPVIM (a contagem acabou)
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Voltar
            </Button>
          </DialogClose>
          <Button onClick={submit} loading={pending} disabled={!valid}>
            Parar e registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
