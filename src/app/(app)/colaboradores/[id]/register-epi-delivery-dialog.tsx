"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { createEpiDeliveryAction, type ActionResult } from "@/server/actions/epi.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { EpiType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const REASON_OPTIONS = [
  { value: "PRIMEIRA_ENTREGA", label: "1 — Primeira entrega, admissão" },
  { value: "SUBSTITUICAO_DANO_JUSTIFICADO", label: "2 — Substituição por dano justificado" },
  { value: "SUBSTITUICAO_DANO_PROPRIO_PERDA", label: "3 — Substituição por dano próprio ou perda" },
  { value: "TROCA_DANIFICADO_VENCIDO", label: "4 — Troca do EPI, danificado ou vencido" },
  { value: "DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO", label: "5 — Devolução, demissão ou mudança de função" },
];

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegisterEpiDeliveryDialog({
  collaboratorId,
  epiTypes,
}: {
  collaboratorId: string;
  epiTypes: EpiType[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEpiDeliveryAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  const [epiTypeId, setEpiTypeId] = useState(epiTypes[0]?.id ?? "");
  const [reason, setReason] = useState("PRIMEIRA_ENTREGA");
  const [traceable, setTraceable] = useState(false);
  const [ca, setCa] = useState(epiTypes[0]?.defaultCa ?? "");

  const selectedType = useMemo(() => epiTypes.find((t) => t.id === epiTypeId), [epiTypes, epiTypeId]);

  function handleTypeChange(id: string) {
    setEpiTypeId(id);
    const type = epiTypes.find((t) => t.id === id);
    setCa(type?.defaultCa ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} disabled={epiTypes.length === 0}>
        <Plus /> Registrar entrega
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar entrega de EPI</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="collaboratorId" value={collaboratorId} />
          <input type="hidden" name="epiTypeId" value={epiTypeId} />
          <input type="hidden" name="reason" value={reason} />
          <input type="hidden" name="traceable" value={traceable ? "on" : ""} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="EPI" required>
              <Select value={epiTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {epiTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Quantidade" htmlFor="quantity">
                <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
              </FormField>
              <FormField label="CA" htmlFor="ca" hint={selectedType?.defaultCa ? undefined : "Sem CA padrão"}>
                <Input id="ca" name="ca" value={ca} onChange={(e) => setCa(e.target.value)} />
              </FormField>
              <FormField label="Tamanho" htmlFor="size" hint="Opcional">
                <Input id="size" name="size" placeholder="Ex: 41, G, P" />
              </FormField>
            </div>

            <FormField label="Motivo" required>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Data de entrega" htmlFor="deliveredAt" required>
              <Input id="deliveredAt" name="deliveredAt" type="date" defaultValue={todayInputValue()} required />
            </FormField>

            <label className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
              <Checkbox checked={traceable} onCheckedChange={(v) => setTraceable(v === true)} className="mt-0.5" />
              <span>
                <Label>Rastreabilidade</Label>
                <p className="text-xs text-foreground-subtle">
                  Gera um QR code e um código individual pra colar neste item físico (use pra
                  capacete, cinturão paraquedista ou qualquer item que você queira rastrear
                  separadamente).
                </p>
              </span>
            </label>

            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
