"use client";

import { useActionState, useState, useTransition } from "react";
import { Link2, GitBranch, RefreshCw, Pencil, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  assignTemplateAction,
  createNewDraftVersionAction,
  renameTemplateAction,
  changeTemplateAreaAction,
  syncAreaTemplateEquipmentAction,
  type ActionResult,
} from "@/server/actions/checklist-template.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { toast } from "sonner";
import type { Equipment } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

export function NewDraftVersionButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await createNewDraftVersionAction(templateId);
      toast.success("Nova versão em rascunho criada.");
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
      <GitBranch /> Nova versão
    </Button>
  );
}

export function SyncAreaEquipmentButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await syncAreaTemplateEquipmentAction(templateId);
      if (result.ok) toast.success("Equipamentos da área sincronizados.");
      else toast.error(result.error);
    });
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} loading={isPending}>
      <RefreshCw /> Sincronizar equipamentos da área
    </Button>
  );
}

export function AssignEquipmentDialog({
  templateId,
  equipments,
  assignedIds,
}: {
  templateId: string;
  equipments: (Equipment & { area: { name: string } })[];
  assignedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignTemplateAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Link2 /> Vincular a equipamentos
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular modelo a equipamentos</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="templateId" value={templateId} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="equipmentIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {equipments.length === 0 && (
              <p className="text-sm text-foreground-subtle">
                Nenhum equipamento do tipo compatível cadastrado ainda.
              </p>
            )}
            {equipments.map((eq) => (
              <label key={eq.id} className="flex items-center gap-2 text-sm text-foreground-muted">
                <Checkbox checked={selected.has(eq.id)} onCheckedChange={() => toggle(eq.id)} />
                {eq.code} — {eq.name} ({eq.area.name})
              </label>
            ))}
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

export function RenameTemplateDialog({ templateId, name, description }: { templateId: string; name: string; description: string | null }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newDescription, setNewDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await renameTemplateAction(templateId, newName, newDescription);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Modelo atualizado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil /> Renomear
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear modelo de checklist</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FormField label="Nome do modelo" htmlFor="template-name" required hint="Ex: Checklist de Carga e Descarga">
            <Input id="template-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </FormField>
          <FormField label="Descrição" htmlFor="template-description" hint="Opcional">
            <Input id="template-description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </FormField>
          <p className="text-xs text-foreground-subtle">Só muda o nome: as versões, perguntas e o histórico de execuções continuam os mesmos.</p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeTemplateAreaDialog({
  templateId,
  currentAreaId,
  currentAreaName,
  areas,
  linkedEquipmentCount,
}: {
  templateId: string;
  currentAreaId: string;
  currentAreaName: string;
  areas: { id: string; name: string }[];
  linkedEquipmentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [areaId, setAreaId] = useState("");
  const [moveEquipment, setMoveEquipment] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!areaId) {
      setError("Escolha a nova área.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await changeTemplateAreaAction(templateId, areaId, moveEquipment);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        res.moved > 0
          ? `Checklist e ${res.moved} equipamento(s) movidos para a nova área.`
          : "Área do checklist alterada.",
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MapPin /> Alterar área
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar a área do checklist</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-foreground-subtle">
            Hoje este checklist é da área <strong className="text-foreground">{currentAreaName}</strong>. Quem trabalha na área nova passa a
            fazer este checklist.
          </p>
          <FormField label="Nova área" required>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Escolha a área" /></SelectTrigger>
              <SelectContent>
                {areas
                  .filter((a) => a.id !== currentAreaId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <Checkbox checked={moveEquipment} onCheckedChange={(v) => setMoveEquipment(v === true)} className="mt-0.5" />
            <span>
              Mover também os {linkedEquipmentCount} equipamento(s) deste checklist para a nova área
              <span className="block text-xs text-foreground-subtle">
                Recomendado: o checklist de área cobre os equipamentos que estão na área. Fica registrado no histórico de cada equipamento.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={isPending}>Alterar área</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
