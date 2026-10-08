"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil, KeyRound } from "lucide-react";
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
  createUserAction,
  updateUserAction,
  resetUserPasswordAction,
  type ActionResult,
} from "@/server/actions/user.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import { ROLE_LABELS, type RoleKeyValue } from "@/domain/shared/permissions";
import type { Area, JobFunction, Role, Unit, User } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

type TurnoOption = { id: string; name: string };

type CollaboratorOption = { id: string; name: string; areaName: string | null };

type FormProps = {
  roles: Role[];
  units: Unit[];
  areas: Area[];
  functions: JobFunction[];
  turnos: TurnoOption[];
  collaborators: CollaboratorOption[];
};

/** Escolha, pessoa por pessoa, de quem o usuário faz a chamada (presença/falta). Guarda a própria
 * seleção — fica dentro do <form>, então os hidden inputs vão junto no envio. */
function CollaboratorPicker({
  collaborators,
  initialIds,
}: {
  collaborators: CollaboratorOption[];
  initialIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? collaborators.filter((c) => c.name.toLowerCase().includes(needle) || (c.areaName ?? "").toLowerCase().includes(needle))
    : collaborators;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected((prev) => new Set([...prev, ...visible.map((c) => c.id)]));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="rollCallCollaboratorIds" value={id} />
      ))}
      <div className="flex items-center justify-between gap-2">
        <Label>Pessoas da chamada</Label>
        <span className="text-xs text-foreground-subtle">{selected.size} selecionada(s)</span>
      </div>
      <p className="text-xs text-foreground-subtle">
        Marque exatamente de quem este usuário vai fazer a chamada (presente ou falta). Soma com as áreas/turnos acima.
      </p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome ou área..."
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto rounded-md border border-border p-2.5">
        {visible.length === 0 && <p className="text-sm text-foreground-subtle">Nenhum colaborador encontrado.</p>}
        {visible.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-foreground-muted">
            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
            <span className="truncate">{c.name}</span>
            {c.areaName && <span className="shrink-0 text-xs text-foreground-subtle">— {c.areaName}</span>}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={selectVisible} className="text-xs text-accent hover:underline">
          Marcar todos {needle ? "do filtro" : ""}
        </button>
        <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-foreground-subtle hover:underline">
          Limpar seleção
        </button>
      </div>
    </div>
  );
}

function AreaChecklist({
  areas,
  selected,
  onToggle,
}: {
  areas: Area[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
      {areas.map((area) => (
        <label key={area.id} className="flex items-center gap-2 text-sm text-foreground-muted">
          <Checkbox
            checked={selected.has(area.id)}
            onCheckedChange={() => onToggle(area.id)}
          />
          {area.name}
        </label>
      ))}
    </div>
  );
}

/** Funções que um usuário Líder gerencia (produtividade do próprio time) — mesmo padrão de
 * `AreaChecklist`, só que por `JobFunction` em vez de `Area`. */
function FunctionChecklist({
  functions,
  selected,
  onToggle,
}: {
  functions: JobFunction[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
      {functions.map((fn) => (
        <label key={fn.id} className="flex items-center gap-2 text-sm text-foreground-muted">
          <Checkbox
            checked={selected.has(fn.id)}
            onCheckedChange={() => onToggle(fn.id)}
          />
          {fn.name}
        </label>
      ))}
    </div>
  );
}

/** Turnos em que o usuário faz chamada — mesmo padrão de `FunctionChecklist`, por `Turno`. */
function TurnoChecklist({
  turnos,
  selected,
  onToggle,
}: {
  turnos: TurnoOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2.5">
      {turnos.length === 0 && <p className="text-sm text-foreground-subtle">Nenhum turno cadastrado.</p>}
      {turnos.map((turno) => (
        <label key={turno.id} className="flex items-center gap-2 text-sm text-foreground-muted">
          <Checkbox
            checked={selected.has(turno.id)}
            onCheckedChange={() => onToggle(turno.id)}
          />
          {turno.name}
        </label>
      ))}
    </div>
  );
}

/** Bloco "Faz chamada?" reaproveitado no criar e no editar — só aparece o checklist de área/turno
 * quando marcado, mas os hidden inputs de área/turno só vão junto do form se `canRollCall` for
 * true (senão a seleção anterior fica "fantasma" e volta a valer se o usuário marcar de novo). */
function RollCallFields({
  areas,
  turnos,
  collaborators,
  initialCollaboratorIds,
  canRollCall,
  onCanRollCallChange,
  selectedAreas,
  onToggleArea,
  selectedTurnos,
  onToggleTurno,
}: {
  areas: Area[];
  turnos: TurnoOption[];
  collaborators: CollaboratorOption[];
  initialCollaboratorIds: string[];
  canRollCall: boolean;
  onCanRollCallChange: (value: boolean) => void;
  selectedAreas: Set<string>;
  onToggleArea: (id: string) => void;
  selectedTurnos: Set<string>;
  onToggleTurno: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <input type="hidden" name="canRollCall" value={canRollCall ? "1" : "0"} />
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Checkbox checked={canRollCall} onCheckedChange={(v) => onCanRollCallChange(v === true)} />
        Faz chamada?
      </label>
      {canRollCall && (
        <>
          {[...selectedAreas].map((id) => (
            <input key={id} type="hidden" name="rollCallAreaIds" value={id} />
          ))}
          {[...selectedTurnos].map((id) => (
            <input key={id} type="hidden" name="rollCallTurnoIds" value={id} />
          ))}
          <div className="flex flex-col gap-1.5">
            <Label>Áreas da chamada</Label>
            <AreaChecklist areas={areas} selected={selectedAreas} onToggle={onToggleArea} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Turnos da chamada</Label>
            <p className="text-xs text-foreground-subtle">Nenhum marcado = todos os turnos das áreas acima.</p>
            <TurnoChecklist turnos={turnos} selected={selectedTurnos} onToggle={onToggleTurno} />
          </div>
          <CollaboratorPicker collaborators={collaborators} initialIds={initialCollaboratorIds} />
        </>
      )}
    </div>
  );
}

export function CreateUserDialog({ roles, units, areas, functions, turnos, collaborators }: FormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());
  const [canRollCall, setCanRollCall] = useState(false);
  const [selectedRollCallAreas, setSelectedRollCallAreas] = useState<Set<string>>(new Set());
  const [selectedRollCallTurnos, setSelectedRollCallTurnos] = useState<Set<string>>(new Set());

  function toggleArea(id: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFunction(id: string) {
    setSelectedFunctions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRollCallArea(id: string) {
    setSelectedRollCallAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRollCallTurno(id: string) {
    setSelectedRollCallTurnos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo usuário
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="unitId" value={unitId} />
          {[...selectedAreas].map((id) => (
            <input key={id} type="hidden" name="areaIds" value={id} />
          ))}
          {[...selectedFunctions].map((id) => (
            <input key={id} type="hidden" name="functionIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="Nome completo" />
            </FormField>
            <FormField label="E-mail" htmlFor="email" required>
              <Input id="email" name="email" type="email" required placeholder="nome@empresa.com" />
            </FormField>
            <FormField label="Senha inicial" htmlFor="password" required hint="Mínimo de 8 caracteres">
              <Input id="password" name="password" type="password" required />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Perfil" required>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {ROLE_LABELS[r.key as RoleKeyValue] ?? r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Unidade">
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Áreas com acesso</Label>
              <AreaChecklist areas={areas} selected={selectedAreas} onToggle={toggleArea} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Funções lideradas (produtividade do time)</Label>
              <FunctionChecklist functions={functions} selected={selectedFunctions} onToggle={toggleFunction} />
            </div>
            <RollCallFields
              areas={areas}
              turnos={turnos}
              collaborators={collaborators}
              initialCollaboratorIds={[]}
              canRollCall={canRollCall}
              onCanRollCallChange={setCanRollCall}
              selectedAreas={selectedRollCallAreas}
              onToggleArea={toggleRollCallArea}
              selectedTurnos={selectedRollCallTurnos}
              onToggleTurno={toggleRollCallTurno}
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

type UserWithAreas = Omit<User, "passwordHash"> & { userAreas: { areaId: string }[] } & { userFunctions: { functionId: string }[] } & {
  userRollCallAreas: { areaId: string }[];
  userRollCallTurnos: { turnoId: string }[];
  userRollCallCollaborators: { collaboratorId: string }[];
};

export function EditUserDialog({ user, roles, units, areas, functions, turnos, collaborators }: FormProps & { user: UserWithAreas }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateUserAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [roleId, setRoleId] = useState(user.roleId);
  const [unitId, setUnitId] = useState(user.unitId ?? "");
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(
    new Set(user.userAreas.map((ua) => ua.areaId)),
  );
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(
    new Set(user.userFunctions.map((uf) => uf.functionId)),
  );
  const [canRollCall, setCanRollCall] = useState(user.canRollCall);
  const [selectedRollCallAreas, setSelectedRollCallAreas] = useState<Set<string>>(
    new Set(user.userRollCallAreas.map((a) => a.areaId)),
  );
  const [selectedRollCallTurnos, setSelectedRollCallTurnos] = useState<Set<string>>(
    new Set(user.userRollCallTurnos.map((t) => t.turnoId)),
  );

  function toggleArea(id: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFunction(id: string) {
    setSelectedFunctions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRollCallArea(id: string) {
    setSelectedRollCallAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRollCallTurno(id: string) {
    setSelectedRollCallTurnos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar usuário">
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário — {user.name}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="roleId" value={roleId} />
          <input type="hidden" name="unitId" value={unitId} />
          {[...selectedAreas].map((id) => (
            <input key={id} type="hidden" name="areaIds" value={id} />
          ))}
          {[...selectedFunctions].map((id) => (
            <input key={id} type="hidden" name="functionIds" value={id} />
          ))}
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor={`edit-name-${user.id}`} required>
              <Input id={`edit-name-${user.id}`} name="name" required defaultValue={user.name} />
            </FormField>
            <FormField label="E-mail" htmlFor={`edit-email-${user.id}`} required>
              <Input id={`edit-email-${user.id}`} name="email" type="email" required defaultValue={user.email} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Perfil" required>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {ROLE_LABELS[r.key as RoleKeyValue] ?? r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Unidade">
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Áreas com acesso</Label>
              <AreaChecklist areas={areas} selected={selectedAreas} onToggle={toggleArea} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Funções lideradas (produtividade do time)</Label>
              <FunctionChecklist functions={functions} selected={selectedFunctions} onToggle={toggleFunction} />
            </div>
            <RollCallFields
              areas={areas}
              turnos={turnos}
              collaborators={collaborators}
              initialCollaboratorIds={user.userRollCallCollaborators.map((c) => c.collaboratorId)}
              canRollCall={canRollCall}
              onCanRollCallChange={setCanRollCall}
              selectedAreas={selectedRollCallAreas}
              onToggleArea={toggleRollCallArea}
              selectedTurnos={selectedRollCallTurnos}
              onToggleTurno={toggleRollCallTurno}
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

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Redefinir senha">
        <KeyRound className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha — {userName}</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={userId} />
          <DialogBody className="flex flex-col gap-4">
            <FormField label="Nova senha" htmlFor={`pwd-${userId}`} required hint="Mínimo de 8 caracteres">
              <Input id={`pwd-${userId}`} name="password" type="password" required />
            </FormField>
            {!state.ok && <p className="text-sm text-danger">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit" loading={pending}>Redefinir</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
