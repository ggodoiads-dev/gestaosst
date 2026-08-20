"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { createAccidentAction, updateAccidentAction, type ActionResult } from "@/server/actions/accident.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Area, Collaborator, Unit, Accident, AccidentInvolvement } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const TYPE_OPTIONS = [
  { value: "ACIDENTE_TIPICO", label: "Acidente típico" },
  { value: "ACIDENTE_TRAJETO", label: "Acidente de trajeto" },
  { value: "QUASE_ACIDENTE", label: "Quase acidente" },
  { value: "DOENCA_OCUPACIONAL", label: "Doença ocupacional" },
  { value: "FAI", label: "FAI" },
];

const SEVERITY_OPTIONS = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

const SIF_OPTIONS = [
  { value: "SIF_PRECURSOR", label: "SIF Precursor" },
  { value: "SIF_POTENCIAL", label: "SIF Potencial" },
  { value: "SIF_REAL", label: "SIF Real" },
];

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreateAccidentDialog({
  areas,
  collaborators,
  mode = "acidente",
}: {
  areas: (Area & { unit: Unit })[];
  collaborators: Collaborator[];
  mode?: "acidente" | "incidente";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAccidentAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [areaId, setAreaId] = useState("none");
  const [type, setType] = useState(mode === "incidente" ? "QUASE_ACIDENTE" : "ACIDENTE_TIPICO");
  const [severity, setSeverity] = useState("MEDIA");
  const [involved, setInvolved] = useState<Set<string>>(new Set());
  const [isSif, setIsSif] = useState(false);
  const [sifClassification, setSifClassification] = useState("SIF_PRECURSOR");
  const label = mode === "incidente" ? "Registrar incidente" : "Registrar acidente";

  function toggleInvolved(id: string) {
    setInvolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="areaId" value={areaId === "none" ? "" : areaId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="severity" value={severity} />
          <input type="hidden" name="isSif" value={isSif ? "on" : ""} />
          {isSif && <input type="hidden" name="sifClassification" value={sifClassification} />}
          {Array.from(involved).map((id) => (
            <input key={id} type="hidden" name="involvedCollaboratorIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data" htmlFor="date" required>
                <Input id="date" name="date" type="date" required />
              </FormField>
              <FormField label="Hora" htmlFor="time" hint="Opcional">
                <Input id="time" name="time" type="time" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tipo" required>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Severidade" required>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

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

            <FormField label="Descrição do que aconteceu" htmlFor="description" required>
              <Textarea id="description" name="description" rows={3} required />
            </FormField>

            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={isSif} onCheckedChange={(v) => setIsSif(v === true)} />
                É SIF?
              </label>

              {isSif && (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-2">
                    <Label>Classificação SIF</Label>
                    <RadioGroup value={sifClassification} onValueChange={setSifClassification}>
                      {SIF_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 rounded-md border border-border-strong px-3.5 py-2.5 text-sm cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft"
                        >
                          <RadioGroupItem value={opt.value} />
                          {opt.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <FormField label="Número do Credit" htmlFor="creditNumber">
                    <Input id="creditNumber" name="creditNumber" placeholder="Número do Credit" />
                  </FormField>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Causa imediata" htmlFor="immediateCause" hint="Opcional">
                <Textarea id="immediateCause" name="immediateCause" rows={2} />
              </FormField>
              <FormField label="Causa raiz" htmlFor="rootCause" hint="Opcional">
                <Textarea id="rootCause" name="rootCause" rows={2} />
              </FormField>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Colaboradores envolvidos</Label>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
                {collaborators.length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhum colaborador cadastrado.</p>
                )}
                {collaborators.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm py-0.5">
                    <Checkbox checked={involved.has(c.id)} onCheckedChange={() => toggleInvolved(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

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

type AccidentWithInvolvements = Accident & { involvements: (AccidentInvolvement & { collaborator: Collaborator })[] };

export function EditAccidentDialog({
  accident,
  areas,
  collaborators,
}: {
  accident: AccidentWithInvolvements;
  areas: (Area & { unit: Unit })[];
  collaborators: Collaborator[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateAccidentAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [areaId, setAreaId] = useState(accident.areaId ?? "none");
  const [type, setType] = useState(accident.type);
  const [severity, setSeverity] = useState(accident.severity);
  const [involved, setInvolved] = useState<Set<string>>(
    () => new Set(accident.involvements.filter((i) => i.role === "VITIMA").map((i) => i.collaboratorId)),
  );
  const [witnesses, setWitnesses] = useState<Set<string>>(
    () => new Set(accident.involvements.filter((i) => i.role === "TESTEMUNHA").map((i) => i.collaboratorId)),
  );
  const [isSif, setIsSif] = useState(accident.isSif);
  const [sifClassification, setSifClassification] = useState(accident.sifClassification ?? "SIF_PRECURSOR");

  function toggleInvolved(id: string) {
    setInvolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWitness(id: string) {
    setWitnesses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label={`Editar ${accident.code}`}>
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar {accident.code}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={accident.id} />
          <input type="hidden" name="areaId" value={areaId === "none" ? "" : areaId} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="severity" value={severity} />
          <input type="hidden" name="isSif" value={isSif ? "on" : ""} />
          {isSif && <input type="hidden" name="sifClassification" value={sifClassification} />}
          {Array.from(involved).map((id) => (
            <input key={id} type="hidden" name="involvedCollaboratorIds" value={id} />
          ))}
          {Array.from(witnesses).map((id) => (
            <input key={id} type="hidden" name="witnessCollaboratorIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data" htmlFor="edit-date" required>
                <Input id="edit-date" name="date" type="date" required defaultValue={toDateInputValue(accident.date)} />
              </FormField>
              <FormField label="Hora" htmlFor="edit-time" hint="Opcional">
                <Input id="edit-time" name="time" type="time" defaultValue={accident.time ?? ""} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tipo" required>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Severidade" required>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

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

            <FormField label="Descrição do que aconteceu" htmlFor="edit-description" required>
              <Textarea id="edit-description" name="description" rows={3} required defaultValue={accident.description} />
            </FormField>

            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={isSif} onCheckedChange={(v) => setIsSif(v === true)} />
                É SIF?
              </label>

              {isSif && (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-2">
                    <Label>Classificação SIF</Label>
                    <RadioGroup value={sifClassification} onValueChange={(v) => setSifClassification(v as typeof sifClassification)}>
                      {SIF_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 rounded-md border border-border-strong px-3.5 py-2.5 text-sm cursor-pointer has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft"
                        >
                          <RadioGroupItem value={opt.value} />
                          {opt.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                  <FormField label="Número do Credit" htmlFor="edit-creditNumber">
                    <Input id="edit-creditNumber" name="creditNumber" placeholder="Número do Credit" defaultValue={accident.creditNumber ?? ""} />
                  </FormField>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Causa imediata" htmlFor="edit-immediateCause" hint="Opcional">
                <Textarea id="edit-immediateCause" name="immediateCause" rows={2} defaultValue={accident.immediateCause ?? ""} />
              </FormField>
              <FormField label="Causa raiz" htmlFor="edit-rootCause" hint="Opcional">
                <Textarea id="edit-rootCause" name="rootCause" rows={2} defaultValue={accident.rootCause ?? ""} />
              </FormField>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Envolvidos</Label>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
                {collaborators.length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhum colaborador cadastrado.</p>
                )}
                {collaborators.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm py-0.5">
                    <Checkbox checked={involved.has(c.id)} onCheckedChange={() => toggleInvolved(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Testemunhas</Label>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
                {collaborators.length === 0 && (
                  <p className="text-sm text-foreground-subtle">Nenhum colaborador cadastrado.</p>
                )}
                {collaborators.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm py-0.5">
                    <Checkbox checked={witnesses.has(c.id)} onCheckedChange={() => toggleWitness(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

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
