"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palmtree } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/label";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { registerVacationAction } from "@/server/actions/schedule.actions";
import { VACATION_MAX_DAYS, isValidVacation, vacationRange } from "@/domain/schedule/vacation";

const br = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

export function VacationDialog({ collaborators }: { collaborators: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [collaboratorId, setCollaboratorId] = useState("");
  const [startKey, setStartKey] = useState("");
  const [days, setDays] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const n = Number(days);
  const valid = !!collaboratorId && isValidVacation(startKey, n);
  const range = valid ? vacationRange(startKey, n) : null;

  function submit() {
    setError(null);
    start(async () => {
      const res = await registerVacationAction({ collaboratorId, startKey, days: n });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setCollaboratorId("");
        setStartKey("");
        setDays("30");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Palmtree className="size-4" /> Cadastrar férias
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar férias</DialogTitle>
          <DialogDescription>Informe o primeiro dia e quantos dias corridos. Os dias entram na escala como férias e a chamada do líder já mostra a pessoa de férias.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="Colaborador" required>
            <select value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
              <option value="">Escolher…</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Primeiro dia" required>
              <input type="date" value={startKey} onChange={(e) => setStartKey(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
            </FormField>
            <FormField label="Dias corridos" required hint={`De 1 a ${VACATION_MAX_DAYS}`}>
              <input type="number" min={1} max={VACATION_MAX_DAYS} value={days} onChange={(e) => setDays(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm tabular-nums text-foreground" />
            </FormField>
          </div>
          {range && (
            <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-foreground">
              Férias de <span className="font-semibold">{br(startKey)}</span> a <span className="font-semibold">{br(range.endKey)}</span> ({n} dias corridos, contando folgas e fins de semana).
              <span className="block text-xs text-foreground-subtle">Volta ao trabalho em {br(range.returnKey)}.</span>
            </p>
          )}
          <p className="text-[11px] text-foreground-subtle">Dias que já têm falta ou atestado lançado não são trocados. Para cancelar férias, clique num dia de férias na escala.</p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={submit} loading={pending} disabled={!valid}>
            Cadastrar férias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
