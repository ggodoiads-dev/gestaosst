"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { setJobFunctionRequiredChecklistsAction } from "@/server/actions/epi.actions";

export function EditJobFunctionChecklistsDialog({
  jobFunction,
  templates,
  currentTemplateIds,
}: {
  jobFunction: { id: string; name: string };
  templates: { id: string; name: string }[];
  currentTemplateIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentTemplateIds));
  const [isPending, startTransition] = useTransition();

  function toggle(templateId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(templateId);
      else next.delete(templateId);
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setJobFunctionRequiredChecklistsAction(jobFunction.id, Array.from(selected));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Checklists obrigatórios de ${jobFunction.name} atualizados.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Editar checklists obrigatórios
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Checklists obrigatórios — {jobFunction.name}</DialogTitle>
          <DialogDescription>
            Todo colaborador com esta função passa a ser cobrado especificamente por esses
            checklists todo dia — na tela de Realizar Checklist ele só vê estes, e no relatório
            de pendência (RH/Ponto) só conta se realmente completar cada um. Sem nenhum marcado,
            volta a valer o comportamento antigo (qualquer checklist conta, se o colaborador
            estiver marcado como "precisa de checklist").
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-sm text-foreground-subtle">Nenhum modelo de checklist publicado ainda.</p>
          )}
          {templates.map((template) => {
            const checked = selected.has(template.id);
            return (
              <label key={template.id} className="flex items-center gap-3 py-1 text-sm">
                <Checkbox
                  id={`req-${jobFunction.id}-${template.id}`}
                  checked={checked}
                  onCheckedChange={(value) => toggle(template.id, value === true)}
                />
                {template.name}
              </label>
            );
          })}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} loading={isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
