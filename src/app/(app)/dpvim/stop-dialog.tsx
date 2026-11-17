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

/** Parar a atividade: quantos itens foram feitos (e, se quiser, como ficaram: bons, transferência, descarte). */
export function StopDpvimDialog({ sessionId, code, expectedLeft }: { sessionId: string; code: string; expectedLeft: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [qtyDone, setQtyDone] = useState("");
  const [good, setGood] = useState("");
  const [transfer, setTransfer] = useState("");
  const [discard, setDiscard] = useState("");
  const [notes, setNotes] = useState("");
  const [finish, setFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = toInt(qtyDone);
  const valid = done !== null && Number.isInteger(done) && done >= 0;
  // Ao finalizar, o que foi contado é comparado com a nota: a diferença vira divergência no painel.
  const balance = finish && valid && done !== null ? done - expectedLeft : 0;

  function submit() {
    if (!valid || done === null) return;
    setError(null);
    start(async () => {
      const res = await stopDpvimSessionAction(sessionId, { qtyDone: done, qtyGood: toInt(good), qtyTransfer: toInt(transfer), qtyDiscard: toInt(discard), notes, finish });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.concluded ? `${code} concluída!` : "Atividade parada. Quantidade registrada.");
      setOpen(false);
      setQtyDone("");
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
          <DialogDescription>Informe quanto vocês fizeram. Ainda faltam {expectedLeft} itens para a carga fechar.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="Quantos itens foram feitos" required hint="Paletes, chapatex ou quadros selecionados nesta atividade">
            <Input value={qtyDone} onChange={(e) => setQtyDone(e.target.value)} inputMode="numeric" placeholder="0" className="tabular-nums" />
          </FormField>
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
            Terminamos esta DPVIM (não sobrou mais nada para contar)
          </label>
          {finish && balance !== 0 && (
            <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
              {balance < 0
                ? `Vai fechar com divergência: faltam ${-balance} em relação à nota. Ela entra no painel de divergências, por fornecedor.`
                : `Vai fechar com divergência: sobraram ${balance} em relação à nota. Ela entra no painel de divergências, por fornecedor.`}{" "}
              Se quiser, explique na observação.
            </p>
          )}
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
