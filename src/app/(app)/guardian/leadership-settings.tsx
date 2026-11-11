"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { saveLeadershipFunctionsAction } from "@/server/actions/guardian.actions";

type FunctionOption = { id: string; name: string; people: number; operational: boolean };

/** Escolhe quais cargos contam como liderança na adesão do Guardian (o resto é operação). */
export function LeadershipSettings({ functions, configured }: { functions: FunctionOption[]; configured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(functions.filter((f) => f.operational).map((f) => f.id)));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function save() {
    start(async () => {
      const res = await saveLeadershipFunctionsAction([...selected]);
      if (res.ok) {
        toast.success("Liderança atualizada. Meses já fechados só mudam se forem recalculados.");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Users className="size-4" /> Liderança do Guardian
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Liderança do Guardian</DialogTitle>
          <DialogDescription>
            Liderança é todo o time do turno ADM. Marque abaixo os cargos do ADM que são <strong>operação</strong> (ex.: ajudante de armazém cadastrado no ADM) —
            eles não entram na liderança. Quem não é do turno ADM é sempre operação.
            {!configured && " Ainda não foi ajustado: a marcação é uma sugestão pelo nome do cargo."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[55vh] overflow-y-auto">
          {functions.length === 0 && <p className="text-sm text-foreground-subtle">Ninguém ativo no turno ADM.</p>}
          <ul className="flex flex-col gap-1">
            {functions.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-muted">
                  <Checkbox checked={selected.has(f.id)} onCheckedChange={(v) => toggle(f.id, v === true)} />
                  <span className="flex-1 text-sm text-foreground">{f.name}</span>
                  <span className="text-xs tabular-nums text-foreground-subtle">{f.people} ativo(s)</span>
                </label>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={pending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
