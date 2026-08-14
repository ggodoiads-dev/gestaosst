"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
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
import {
  createCollaboratorAction,
  updateCollaboratorAction,
  type ActionResult,
} from "@/server/actions/collaborator.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Area, Collaborator, JobFunction, ScheduleType, Turno, Unit } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

type FormProps = {
  areas: (Area & { unit: Unit })[];
  turnos: (Turno & { scheduleType: ScheduleType })[];
  jobFunctions: JobFunction[];
};

type CollaboratorDefaults = {
  name?: string;
  matricula?: string | null;
  functionId?: string | null;
  cpf?: string | null;
  ctps?: string | null;
  ctpsSerie?: string | null;
  admissionDate?: Date | null;
  areaId?: string | null;
  turnoId?: string | null;
  phone?: string | null;
  checklistEnabled?: boolean;
};

function toDateInputValue(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CollaboratorFields({
  areas,
  turnos,
  jobFunctions,
  defaults,
  idPrefix,
}: FormProps & { defaults?: CollaboratorDefaults; idPrefix: string }) {
  const [areaId, setAreaId] = useState(defaults?.areaId ?? "none");
  const [turnoId, setTurnoId] = useState(defaults?.turnoId ?? "none");
  const [functionId, setFunctionId] = useState(defaults?.functionId ?? "none");
  const [checklistEnabled, setChecklistEnabled] = useState(defaults?.checklistEnabled ?? false);

  return (
    <>
      <input type="hidden" name="areaId" value={areaId === "none" ? "" : areaId} />
      <input type="hidden" name="turnoId" value={turnoId === "none" ? "" : turnoId} />
      <input type="hidden" name="functionId" value={functionId === "none" ? "" : functionId} />
      <input type="hidden" name="checklistEnabled" value={checklistEnabled ? "on" : ""} />

      <FormField label="Nome" htmlFor={`${idPrefix}-name`} required>
        <Input id={`${idPrefix}-name`} name="name" required placeholder="Nome completo" defaultValue={defaults?.name ?? ""} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Matrícula" htmlFor={`${idPrefix}-matricula`}>
          <Input id={`${idPrefix}-matricula`} name="matricula" placeholder="Opcional" defaultValue={defaults?.matricula ?? ""} />
        </FormField>
        <FormField label="Função" hint="Define o kit de EPI lançado automaticamente na ficha">
          <Select value={functionId} onValueChange={setFunctionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem função definida</SelectItem>
              {jobFunctions.map((jf) => (
                <SelectItem key={jf.id} value={jf.id}>{jf.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Data de admissão" htmlFor={`${idPrefix}-admissionDate`}>
          <Input
            id={`${idPrefix}-admissionDate`}
            name="admissionDate"
            type="date"
            defaultValue={toDateInputValue(defaults?.admissionDate)}
          />
        </FormField>
        <FormField label="Telefone" htmlFor={`${idPrefix}-phone`}>
          <Input id={`${idPrefix}-phone`} name="phone" placeholder="Opcional" defaultValue={defaults?.phone ?? ""} />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="CPF" htmlFor={`${idPrefix}-cpf`}>
          <Input id={`${idPrefix}-cpf`} name="cpf" placeholder="Opcional" defaultValue={defaults?.cpf ?? ""} />
        </FormField>
        <FormField label="CTPS" htmlFor={`${idPrefix}-ctps`}>
          <Input id={`${idPrefix}-ctps`} name="ctps" placeholder="Opcional" defaultValue={defaults?.ctps ?? ""} />
        </FormField>
        <FormField label="Série CTPS" htmlFor={`${idPrefix}-ctpsSerie`}>
          <Input id={`${idPrefix}-ctpsSerie`} name="ctpsSerie" placeholder="Opcional" defaultValue={defaults?.ctpsSerie ?? ""} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Área" hint="Opcional">
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem área definida</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.unit.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Turno" hint="Opcional — define a escala de trabalho/folga">
          <Select value={turnoId} onValueChange={setTurnoId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem turno definido</SelectItem>
              {turnos.map((t) => (
                <SelectItem key={t.id} value={t.id}>Turno {t.name} ({t.scheduleType.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <label className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
        <Checkbox
          checked={checklistEnabled}
          onCheckedChange={(v) => setChecklistEnabled(v === true)}
          className="mt-0.5"
        />
        <span>
          <Label>Faz checklist</Label>
          <p className="text-xs text-foreground-subtle">
            Precisa de acesso ao sistema pra realizar checklist da própria área. Marcando isso, um
            usuário e senha podem ser gerados na página do colaborador.
          </p>
        </span>
      </label>
    </>
  );
}

export function CreateCollaboratorDialog(props: FormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createCollaboratorAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo colaborador
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo colaborador</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <CollaboratorFields {...props} idPrefix="new" />
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

export function EditCollaboratorDialog({
  collaborator,
  ...props
}: FormProps & { collaborator: Collaborator }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateCollaboratorAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar colaborador">
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar colaborador — {collaborator.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={collaborator.id} />
          <DialogBody className="flex flex-col gap-4">
            <CollaboratorFields
              {...props}
              idPrefix={`edit-${collaborator.id}`}
              defaults={{
                name: collaborator.name,
                matricula: collaborator.matricula,
                functionId: collaborator.functionId,
                cpf: collaborator.cpf,
                ctps: collaborator.ctps,
                ctpsSerie: collaborator.ctpsSerie,
                admissionDate: collaborator.admissionDate,
                areaId: collaborator.areaId,
                turnoId: collaborator.turnoId,
                phone: collaborator.phone,
                checklistEnabled: collaborator.checklistEnabled,
              }}
            />
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
