"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, Label } from "@/components/ui/label";
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
import { createTemplateAction, type ActionResult } from "@/server/actions/checklist-template.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { cn } from "@/lib/utils";
import type { Area, EquipmentType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

type Scope = "EQUIPAMENTO" | "AREA";

export function CreateTemplateDialog({ types, areas }: { types: EquipmentType[]; areas: Area[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("EQUIPAMENTO");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo modelo
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo modelo de checklist</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="scope" value={scope} />
          {scope === "EQUIPAMENTO" ? (
            <input type="hidden" name="equipmentTypeId" value={typeId} />
          ) : (
            <input type="hidden" name="areaId" value={areaId} />
          )}
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="name" required hint="Ex: Inspeção Diária — Paleteira Elétrica">
              <Input id="name" name="name" required />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <Label>Escopo</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope("EQUIPAMENTO")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                    scope === "EQUIPAMENTO"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border-strong text-foreground-muted hover:bg-surface-muted",
                  )}
                >
                  Por equipamento
                </button>
                <button
                  type="button"
                  onClick={() => setScope("AREA")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                    scope === "AREA"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border-strong text-foreground-muted hover:bg-surface-muted",
                  )}
                >
                  Por área
                </button>
              </div>
              <p className="text-xs text-foreground-subtle">
                {scope === "EQUIPAMENTO"
                  ? "Cada equipamento tem sua própria execução, como sempre."
                  : "Um checklist único pra área: todo equipamento ativo dela entra como item, respondido de uma vez."}
              </p>
            </div>

            {scope === "EQUIPAMENTO" ? (
              <FormField label="Tipo de equipamento" required>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <FormField label="Área" required>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <FormField label="Descrição" htmlFor="description">
              <Textarea id="description" name="description" rows={2} />
            </FormField>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
