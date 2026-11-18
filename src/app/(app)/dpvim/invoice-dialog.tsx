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

export type InvoiceLine = { kind: string; label: string; invoice: number | null };

/** Quem tem acesso à nota informa (ou corrige) a quantidade dela, produto a produto. Só aparece para quem vê a nota; o produto em branco fica como "nota não informada". */
export function InvoiceQtyDialog({ id, code, lines }: { id: string; code: string; lines: InvoiceLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.kind, l.invoice === null ? "" : String(l.invoice)])));
  const [error, setError] = useState<string | null>(null);
  const isOk = (v: string) => v.trim() === "" || (Number.isInteger(Number(v)) && Number(v) > 0);
  const valid = lines.every((l) => isOk(qty[l.kind] ?? ""));
  const anyInformed = lines.some((l) => l.invoice !== null);

  function save() {
    if (!valid) return;
    setError(null);
    start(async () => {
      const res = await setDpvimInvoiceQtyAction(
        id,
        lines.map((l) => ({ kind: l.kind, qty: (qty[l.kind] ?? "").trim() === "" ? null : Number(qty[l.kind]) })),
      );
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
        <Button size="sm" variant="secondary">
          <FileText className="size-4" /> {anyInformed ? "Alterar a quantidade da nota" : "Informar a quantidade da nota"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quantidade da nota · {code}</DialogTitle>
          <DialogDescription>Quem recebe e conta a DPVIM não vê esses números. Eles são comparados com a contagem dos ajudantes para achar divergência.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {lines.map((l) => (
            <FormField key={l.kind} label={`${l.label} na nota`}>
              <Input value={qty[l.kind] ?? ""} onChange={(e) => setQty((prev) => ({ ...prev, [l.kind]: e.target.value }))} inputMode="numeric" className="tabular-nums" />
            </FormField>
          ))}
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
