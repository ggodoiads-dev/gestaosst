"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { addManualBankEntryAction } from "@/server/actions/bank-hours.actions";

const field = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

/** Lançamento manual no banco de horas (troca de folga, acordo, correção): crédito soma dias, débito abate. */
export function ManualEntryDialog({ collaborators, presetId }: { collaborators: { id: string; name: string }[]; presetId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [collaboratorId, setCollaboratorId] = useState(presetId ?? "");
  const [kind, setKind] = useState<"credito" | "debito">("credito");
  const [days, setDays] = useState("1");
  const [dateKey, setDateKey] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = Number(days.replace(",", "."));
  const valid = !!collaboratorId && !!dateKey && Number.isFinite(n) && n > 0 && note.trim().length >= 3;

  function submit() {
    setError(null);
    start(async () => {
      const res = await addManualBankEntryAction({ collaboratorId, dateKey, days: kind === "credito" ? n : -n, note });
      if (res.ok) {
        toast.success("Lançamento salvo.");
        setOpen(false);
        setNote("");
        setDays("1");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={presetId ? "ghost" : "secondary"} size={presetId ? "sm" : "md"}>
          <Plus className="size-4" /> Lançar manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançamento manual no banco de horas</DialogTitle>
          <DialogDescription>Para troca de folga, acordo ou correção. Crédito soma dias de folga; débito abate. Os dias de folga tirados na escala (BH-) já abatem sozinhos.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="Colaborador" required>
            <select value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)} className={field}>
              <option value="">Escolher…</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tipo" required>
              <select value={kind} onChange={(e) => setKind(e.target.value as "credito" | "debito")} className={field}>
                <option value="credito">Crédito (+)</option>
                <option value="debito">Débito (−)</option>
              </select>
            </FormField>
            <FormField label="Dias" required hint="Ex.: 1 ou 0,5">
              <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="decimal" className={field + " tabular-nums"} />
            </FormField>
            <FormField label="Data" required>
              <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} className={field} />
            </FormField>
          </div>
          <FormField label="Motivo" required>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: troca de folga com o fulano em 08/11" className={field} maxLength={300} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} loading={pending} disabled={!valid}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
