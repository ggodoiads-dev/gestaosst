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

type FormProps = { roles: Role[]; units: Unit[]; areas: Area[]; functions: JobFunction[] };

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

export function CreateUserDialog({ roles, units, areas, functions }: FormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());

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

type UserWithAreas = User & { userAreas: { areaId: string }[] } & { userFunctions: { functionId: string }[] };

export function EditUserDialog({ user, roles, units, areas, functions }: FormProps & { user: UserWithAreas }) {
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
