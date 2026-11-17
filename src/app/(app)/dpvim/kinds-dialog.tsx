"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDpvimKindAction, setDpvimKindActiveAction } from "@/server/actions/dpvim.actions";
import type { DpvimKindOption } from "@/domain/dpvim/rules";

/** Cadastro dos tipos de DPVIM: palete, chapatex e quadro já vêm; aqui entram os outros, que passam a aparecer na hora de cadastrar uma DPVIM. */
export function DpvimKindsDialog({ kinds, disabled }: { kinds: DpvimKindOption[]; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (label.trim().length < 2) return;
    setError(null);
    start(async () => {
      const res = await createDpvimKindAction(label);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Tipo cadastrado. Já aparece na hora de cadastrar uma DPVIM.");
      setLabel("");
      router.refresh();
    });
  }

  function toggle(id: string, active: boolean) {
    start(async () => {
      const res = await setDpvimKindActiveAction(id, active);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={disabled}>
          <Tags className="size-4" /> Tipos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tipos de DPVIM</DialogTitle>
          <DialogDescription>Os tipos que você cadastrar aparecem na lista ao cadastrar uma DPVIM e nos filtros do painel.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="Ex.: Barril, Garrafeira"
                maxLength={40}
                aria-label="Nome do novo tipo"
              />
            </div>
            <Button onClick={add} loading={pending} disabled={label.trim().length < 2}>
              Cadastrar
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {kinds.map((k) => (
              <li key={k.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className={k.active ? "text-foreground" : "text-foreground-subtle line-through"}>{k.label}</span>
                {k.builtin ? (
                  <Badge tone="neutral">de fábrica</Badge>
                ) : (
                  <Button size="sm" variant="ghost" disabled={pending || !k.id} onClick={() => k.id && toggle(k.id, !k.active)}>
                    {k.active ? "Desativar" : "Reativar"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground-subtle">Desativar tira o tipo das opções de novo cadastro; as DPVIM que já usam esse tipo continuam como estão.</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
