"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
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
  createEquipmentAction,
  updateEquipmentAction,
  type ActionResult,
} from "@/server/actions/equipment.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { Area, Equipment, EquipmentType, Unit, User } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const CRITICALITY_OPTIONS = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

type FormProps = {
  types: EquipmentType[];
  areas: (Area & { unit: Unit })[];
  users: User[];
};

type EquipmentDefaults = {
  code?: string;
  name?: string;
  assetTag?: string | null;
  typeId?: string;
  areaId?: string;
  sector?: string | null;
  responsibleId?: string | null;
  criticality?: string;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
};

function PhotoField({ idPrefix, currentPhotoUrl }: { idPrefix: string; currentPhotoUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl ?? null);

  return (
    <FormField label="Foto do equipamento" htmlFor={`${idPrefix}-photo`} hint="Opcional — JPEG, PNG ou WEBP, até 8MB">
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border-strong bg-surface-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) ou foto já salva
            <img src={preview} alt="Prévia da foto" className="size-full object-cover" />
          ) : (
            <Camera className="size-5 text-foreground-subtle" />
          )}
        </div>
        <Input
          id={`${idPrefix}-photo`}
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
        />
      </div>
    </FormField>
  );
}

function EquipmentFields({
  types,
  areas,
  users,
  defaults,
  idPrefix,
}: FormProps & { defaults?: EquipmentDefaults; idPrefix: string }) {
  const [areaId, setAreaId] = useState(defaults?.areaId ?? areas[0]?.id ?? "");
  const [typeId, setTypeId] = useState(defaults?.typeId ?? types[0]?.id ?? "");
  const [responsibleId, setResponsibleId] = useState(defaults?.responsibleId ?? "");
  const [criticality, setCriticality] = useState(defaults?.criticality ?? "MEDIA");

  const selectedArea = areas.find((a) => a.id === areaId);

  return (
    <>
      <input type="hidden" name="typeId" value={typeId} />
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="unitId" value={selectedArea?.unitId ?? ""} />
      <input type="hidden" name="responsibleId" value={responsibleId} />
      <input type="hidden" name="criticality" value={criticality} />

      <PhotoField idPrefix={idPrefix} currentPhotoUrl={defaults?.photoUrl} />

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Código" htmlFor={`${idPrefix}-code`} required hint="Ex: PE-005">
          <Input id={`${idPrefix}-code`} name="code" required placeholder="PE-005" defaultValue={defaults?.code ?? ""} />
        </FormField>
        <FormField label="Patrimônio" htmlFor={`${idPrefix}-assetTag`}>
          <Input id={`${idPrefix}-assetTag`} name="assetTag" placeholder="Opcional" defaultValue={defaults?.assetTag ?? ""} />
        </FormField>
      </div>

      <FormField label="Nome" htmlFor={`${idPrefix}-name`} required>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          placeholder="Ex: Paleteira Elétrica PE-005"
          defaultValue={defaults?.name ?? ""}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
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
        <FormField label="Criticidade" required>
          <Select value={criticality} onValueChange={setCriticality}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CRITICALITY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Área" required hint="A unidade é definida pela área">
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.unit.name})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Setor" htmlFor={`${idPrefix}-sector`}>
          <Input id={`${idPrefix}-sector`} name="sector" placeholder="Opcional" defaultValue={defaults?.sector ?? ""} />
        </FormField>
      </div>

      <FormField label="Responsável" hint="Opcional">
        <Select value={responsibleId || "none"} onValueChange={(v) => setResponsibleId(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem responsável definido</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Fabricante" htmlFor={`${idPrefix}-manufacturer`}>
          <Input id={`${idPrefix}-manufacturer`} name="manufacturer" placeholder="Opcional" defaultValue={defaults?.manufacturer ?? ""} />
        </FormField>
        <FormField label="Modelo" htmlFor={`${idPrefix}-model`}>
          <Input id={`${idPrefix}-model`} name="model" placeholder="Opcional" defaultValue={defaults?.model ?? ""} />
        </FormField>
        <FormField label="Nº de série" htmlFor={`${idPrefix}-serialNumber`}>
          <Input id={`${idPrefix}-serialNumber`} name="serialNumber" placeholder="Opcional" defaultValue={defaults?.serialNumber ?? ""} />
        </FormField>
      </div>

      <FormField label="Observações administrativas" htmlFor={`${idPrefix}-notes`}>
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </FormField>
    </>
  );
}

export function CreateEquipmentDialog(props: FormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEquipmentAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo equipamento
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo equipamento</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <EquipmentFields {...props} idPrefix="new" />
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

export function EditEquipmentDialog({
  equipment,
  photoUrl,
  ...props
}: FormProps & { equipment: Equipment; photoUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateEquipmentAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar equipamento">
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar equipamento — {equipment.code}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={equipment.id} />
          <DialogBody className="flex flex-col gap-4">
            <EquipmentFields
              {...props}
              idPrefix={`edit-${equipment.id}`}
              defaults={{
                code: equipment.code,
                name: equipment.name,
                assetTag: equipment.assetTag,
                typeId: equipment.typeId,
                areaId: equipment.areaId,
                sector: equipment.sector,
                responsibleId: equipment.responsibleId,
                criticality: equipment.criticality,
                manufacturer: equipment.manufacturer,
                model: equipment.model,
                serialNumber: equipment.serialNumber,
                notes: equipment.notes,
                photoUrl,
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
