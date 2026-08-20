"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  createQualificationTypeAction,
  updateQualificationTypeAction,
  type ActionResult,
} from "@/server/actions/qualification.actions";
import { useCloseOnSuccess } from "@/lib/use-close-on-success";
import type { QualificationType } from "@/generated/prisma/client";

const initialState: ActionResult = { ok: true };

const CATEGORY_OPTIONS = [
  { value: "NR", label: "NR" },
  { value: "ASO", label: "ASO" },
  { value: "INTEGRACAO", label: "Integração" },
  { value: "OUTRO", label: "Outro" },
];

function QualificationTypeFields({
  defaults,
  idPrefix,
}: {
  defaults?: { name?: string; category?: string; validityMonths?: number | null; aliases?: string[] };
  idPrefix: string;
}) {
  const [category, setCategory] = useState(defaults?.category ?? "NR");
  const [aliases, setAliases] = useState<string[]>(defaults?.aliases ?? []);
  const [aliasInput, setAliasInput] = useState("");

  function addAlias() {
    const value = aliasInput.trim();
    if (!value || aliases.includes(value)) {
      setAliasInput("");
      return;
    }
    setAliases((prev) => [...prev, value]);
    setAliasInput("");
  }

  return (
    <>
      <input type="hidden" name="category" value={category} />
      {aliases.map((alias) => (
        <input key={alias} type="hidden" name="aliases" value={alias} />
      ))}

      <FormField label="Nome" htmlFor={`${idPrefix}-name`} required hint="Ex: NR-35 — Trabalho em Altura">
        <Input id={`${idPrefix}-name`} name="name" required placeholder="Ex: NR-35 — Trabalho em Altura" defaultValue={defaults?.name ?? ""} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Categoria" required>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Validade (meses)" htmlFor={`${idPrefix}-validityMonths`} hint="Deixe vazio se não expira">
          <Input
            id={`${idPrefix}-validityMonths`}
            name="validityMonths"
            type="number"
            min={1}
            placeholder="Ex: 12"
            defaultValue={defaults?.validityMonths ?? ""}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Sinônimos</Label>
        <p className="text-xs text-foreground-subtle">
          Outros nomes que devem casar com este tipo na hora de importar planilha (ex: &quot;NR11&quot;, &quot;Operador de Empilhadeira&quot;).
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Digite e clique em Adicionar"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAlias();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addAlias}>Adicionar</Button>
        </div>
        {aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {aliases.map((alias) => (
              <Badge key={alias} tone="neutral" className="gap-1.5">
                {alias}
                <button
                  type="button"
                  onClick={() => setAliases((prev) => prev.filter((a) => a !== alias))}
                  aria-label={`Remover sinônimo ${alias}`}
                  className="text-foreground-subtle hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function CreateQualificationTypeDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createQualificationTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Novo tipo
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tipo de qualificação</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-4">
            <QualificationTypeFields idPrefix="new" />
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

export function EditQualificationTypeDialog({ type }: { type: QualificationType }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateQualificationTypeAction, initialState);
  useCloseOnSuccess(pending, state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Editar tipo de qualificação">
        <Pencil className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tipo de qualificação</DialogTitle>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={type.id} />
          <DialogBody className="flex flex-col gap-4">
            <QualificationTypeFields
              idPrefix={`edit-${type.id}`}
              defaults={{ name: type.name, category: type.category, validityMonths: type.validityMonths, aliases: type.aliases }}
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
