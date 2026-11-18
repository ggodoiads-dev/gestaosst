"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { setDpvimInvoiceQtyAction } from "@/server/actions/dpvim.actions";

/** Quem tem acesso à nota informa (ou corrige) a quantidade dela. Só aparece para quem vê a nota; com isso a divergência aparece depois que a DPVIM é finalizada. */
export function InvoiceQtyDialog({ id, code, current, size = "sm" }: { id: string; code: string; current: number | null; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(current ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const n = Number(qty);
  const valid = qty.trim() !== "" && Number.isInteger(n) && n > 0;

  function save() {
    if (!valid) return;
    setError(null);
    start(async () => {
      const res = await setDpvimInvoiceQtyAction(id, n);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Quantidade da nota salva.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="secondary">
          <FileText className="size-4" /> {current ? "Alterar a quantidade da nota" : "Informar a quantidade da nota"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quantidade da nota · {code}</DialogTitle>
          <DialogDescription>Quem lança e conta a DPVIM não vê esse número. Ele só é comparado com a contagem para achar divergência.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <FormField label="Quantos itens a nota diz" required>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="tabular-nums" autoFocus />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending} disabled={!valid}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
