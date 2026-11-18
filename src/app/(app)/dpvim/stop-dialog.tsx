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

/**
 * Parar a atividade: quanto os ajudantes contaram de cada produto da DPVIM (e, se quiser, como ficaram: bons, transferência, descarte).
 * O "norte" do conferente aparece só como referência: dá para contar mais ou menos do que ele.
 */
export function StopDpvimDialog({ sessionId, code, lines }: { sessionId: string; code: string; lines: StopLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [good, setGood] = useState("");
  const [transfer, setTransfer] = useState("");
  const [discard, setDiscard] = useState("");
  const [notes, setNotes] = useState("");
  const [finish, setFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = lines.map((l) => ({ kind: l.kind, n: toInt(qty[l.kind] ?? "") }));
  // Cada produto pode ficar em branco (= 0), mas o que for digitado tem que ser um número inteiro; ao menos um precisa ter número.
  const valid = values.every((v) => v.n === null || (Number.isInteger(v.n) && v.n >= 0)) && values.some((v) => v.n !== null);
  const total = values.reduce((s, v) => s + (v.n ?? 0), 0);

  function submit() {
    if (!valid) return;
    setError(null);
    start(async () => {
      const res = await stopDpvimSessionAction(sessionId, {
        items: values.map((v) => ({ kind: v.kind, qty: v.n ?? 0 })),
        qtyGood: toInt(good),
        qtyTransfer: toInt(transfer),
        qtyDiscard: toInt(discard),
        notes,
        finish,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.concluded ? `${code} concluída!` : "Atividade parada. Quantidade registrada.");
      setOpen(false);
      setQty({});
      setGood("");
      setTransfer("");
      setDiscard("");
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
          <DialogDescription>Informe quanto vocês contaram de cada produto nesta atividade. O norte do conferente é só uma referência, não um limite.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {lines.map((l) => (
            <FormField key={l.kind} label={`Quantos de ${l.label} foram feitos`} required={lines.length === 1} hint={`Norte do conferente: ${l.expected}`}>
              <Input value={qty[l.kind] ?? ""} onChange={(e) => setQty((prev) => ({ ...prev, [l.kind]: e.target.value }))} inputMode="numeric" placeholder="0" className="tabular-nums" />
            </FormField>
          ))}
          {lines.length > 1 && <p className="text-xs tabular-nums text-foreground-subtle">Total desta atividade: {total}</p>}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Bons">
              <Input value={good} onChange={(e) => setGood(e.target.value)} inputMode="numeric" className="tabular-nums" />
            </FormField>
            <FormField label="Transferência">
              <Input value={transfer} onChange={(e) => setTransfer(e.target.value)} inputMode="numeric" className="tabular-nums" />
            </FormField>
            <FormField label="Descarte">
              <Input value={discard} onChange={(e) => setDiscard(e.target.value)} inputMode="numeric" className="tabular-nums" />
            </FormField>
          </div>
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
