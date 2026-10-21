"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  createNodeAction,
  deleteNodeAction,
  seedCascadeAction,
  setNodeValueAction,
  updateNodeAction,
  type NodeFormInput,
} from "@/server/actions/cascade.actions";
import { UNIT_LABELS, type CascadePace, type CascadePolarity, type CascadeUnit } from "@/domain/cascade/status";

export function SeedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await seedCascadeAction();
          if (!res.ok) toast.error(res.error);
          else {
            toast.success(`Estrutura carregada (${res.created ?? 0} itens).`);
            router.refresh();
          }
        })
      }
    >
      Carregar estrutura inicial
    </Button>
  );
}

function numText(value: number | null) {
  return value === null ? "" : String(value).replace(".", ",");
}

/** Informar o resultado do período (sobrescreve o valor automático do SIGO, se houver). */
export function ValueDialog({
  nodeId,
  nodeName,
  periodKey,
  currentValue,
  isAuto,
  trigger,
}: {
  nodeId: string;
  nodeName: string;
  periodKey: string;
  currentValue: number | null;
  isAuto: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(numText(currentValue));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(clear: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setNodeValueAction(nodeId, periodKey, clear ? "" : value, note);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(clear ? "Valor removido." : "Resultado atualizado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atualizar resultado</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3 text-sm">
          <p className="font-medium text-foreground">{nodeName}</p>
          {isAuto && <p className="text-xs text-foreground-subtle">Hoje este valor vem do SIGO automaticamente. Se você informar um valor, ele passa na frente do automático neste mês.</p>}
          <FormField label={`Resultado de ${periodKey.split("-").reverse().join("/")}`} required>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Ex: 97,41" />
          </FormField>
          <FormField label="Observação" hint="Opcional">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={() => save(true)} loading={pending}>Remover valor</Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => save(false)} loading={pending}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type NodeDialogProps = {
  mode: "create-iv" | "create-ic" | "edit";
  parentId?: string;
  node?: {
    id: string;
    name: string;
    description: string | null;
    unit: CascadeUnit;
    polarity: CascadePolarity;
    pace: CascadePace;
    target: number | null;
    ownerId: string | null;
    reviewNote: string | null;
  };
  owners: { id: string; name: string }[];
  trigger: React.ReactNode;
};

/** Criar um IV (ou IC) ou editar o nó: nome, unidade, sentido da meta, ritmo, meta e responsável. */
export function NodeDialog({ mode, parentId, node, owners, trigger }: NodeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NodeFormInput>({
    name: node?.name ?? "",
    description: node?.description ?? "",
    unit: node?.unit ?? "NUMBER",
    polarity: node?.polarity ?? "HIGHER",
    pace: node?.pace ?? "NONE",
    target: numText(node?.target ?? null),
    ownerUserId: node?.ownerId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof NodeFormInput>(key: K, value: NodeFormInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res =
        mode === "edit"
          ? await updateNodeAction(node!.id, form)
          : await createNodeAction(parentId!, mode === "create-ic" ? "IC" : "IV", form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(mode === "edit" ? "Atualizado." : mode === "create-ic" ? "IC criado." : "IV criado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar" : mode === "create-ic" ? "Novo IC (o quê)" : "Novo IV (como)"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {node?.reviewNote && (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              Conferir: {node.reviewNote} Ao salvar, esse aviso some.
            </p>
          )}
          <FormField label="Nome" required hint={mode === "create-iv" ? "O que a rotina precisa fazer. Ex: Fazer 1 DTO por semana" : undefined}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unidade">
              <Select value={form.unit} onValueChange={(v) => set("unit", v as CascadeUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(UNIT_LABELS) as CascadeUnit[]).map((u) => (
                    <SelectItem key={u} value={u}>{UNIT_LABELS[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Meta" hint="Vazio = sem meta">
              <Input value={form.target} onChange={(e) => set("target", e.target.value)} inputMode="decimal" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sentido da meta">
              <Select value={form.polarity} onValueChange={(v) => set("polarity", v as CascadePolarity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGHER">Maior é melhor</SelectItem>
                  <SelectItem value="LOWER">Menor é melhor</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Ritmo da meta">
              <Select value={form.pace} onValueChange={(v) => set("pace", v as CascadePace)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Meta fixa</SelectItem>
                  <SelectItem value="YEAR">Anual (proporcional ao mês)</SelectItem>
                  <SelectItem value="MONTH">Mensal (proporcional aos dias)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Responsável">
            <Select value={form.ownerUserId || "none"} onValueChange={(v) => set("ownerUserId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Descrição" hint="Opcional">
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteNodeDialog({ nodeId, nodeName, childCount, trigger }: { nodeId: string; nodeName: string; childCount: number; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir este item?</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">{nodeName}</p>
          <p className="text-foreground-subtle">
            {childCount > 0 ? `Os ${childCount} item(ns) abaixo dele e todos os resultados lançados também são apagados. ` : "Os resultados lançados também são apagados. "}
            Não dá para desfazer.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteNodeAction(nodeId);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Excluído.");
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
