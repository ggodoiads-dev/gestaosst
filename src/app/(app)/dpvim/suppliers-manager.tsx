"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import {
  createDpvimSupplierAction,
  mergeDpvimSupplierAction,
  setDpvimSupplierActiveAction,
  updateDpvimSupplierAction,
} from "@/server/actions/dpvim.actions";
import { similarSuppliers } from "@/domain/dpvim/rules";
import type { DpvimSupplierOverview } from "@/server/services/dpvim.service";

const field = "h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground";

function SupplierRow({ s, all, busy, run }: { s: DpvimSupplierOverview; all: DpvimSupplierOverview[]; busy: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void }) {
  const [mode, setMode] = useState<"view" | "edit" | "merge">("view");
  const [name, setName] = useState(s.name);
  const [unit, setUnit] = useState(s.unit ?? "");
  const [target, setTarget] = useState("");
  const others = all.filter((o) => o.id !== s.id);

  if (mode === "edit") {
    return (
      <li className="flex flex-col gap-2 px-3 py-2">
        <div className="grid grid-cols-2 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nome do fornecedor" />
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={60} placeholder="Unidade (opcional)" aria-label="Unidade" />
        </div>
        <p className="text-xs text-foreground-subtle">Ao salvar, as DPVIM desse fornecedor passam a usar o nome novo.</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancelar
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={name.trim().length < 2}
            onClick={() => {
              run(() => updateDpvimSupplierAction(s.id, name, unit.trim() ? unit : null), "Fornecedor atualizado.");
              setMode("view");
            }}
          >
            Salvar
          </Button>
        </div>
      </li>
    );
  }

  if (mode === "merge") {
    return (
      <li className="flex flex-col gap-2 px-3 py-2">
        <p className="text-sm text-foreground">
          Unir <strong>{s.label}</strong> com:
        </p>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
          <option value="">Escolher o fornecedor que fica…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-foreground-subtle">Todas as DPVIM de {s.label} passam para o fornecedor escolhido, e {s.label} sai da lista. Não dá para desfazer.</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
            Cancelar
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={!target}
            onClick={() => {
              run(() => mergeDpvimSupplierAction(s.id, target), "Fornecedores unidos.");
              setMode("view");
            }}
          >
            Unir
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="flex min-w-0 flex-col">
        <Link href={`/dpvim/fornecedores/${s.id}`} className={s.active ? "font-medium text-accent hover:underline" : "font-medium text-foreground-subtle line-through hover:underline"}>
          {s.label}
        </Link>
        <span className="text-xs text-foreground-subtle">
          {s.total === 0 ? "Nenhuma DPVIM ainda" : `${s.total} DPVIM`}
          {s.open > 0 ? ` · ${s.open} em aberto` : ""}
          {s.late > 0 ? <strong className="text-danger"> · {s.late} atrasada(s)</strong> : null}
          {s.lastArrivedAt ? ` · última chegada ${formatDateTime(s.lastArrivedAt)}` : ""}
          {" · "}
          <span className="text-accent">ver histórico</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("edit")}>
          Editar
        </Button>
        {others.length > 0 && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("merge")}>
            Unir
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setDpvimSupplierActiveAction(s.id, !s.active))}>
          {s.active ? "Desativar" : "Reativar"}
        </Button>
      </span>
    </li>
  );
}

/** A aba de fornecedores da DPVIM (nome e unidade): cadastra, edita, une, desativa e cadastra de uma vez os nomes já usados em DPVIM. */
export function SuppliersManager({ suppliers, unregistered }: { suppliers: DpvimSupplierOverview[]; unregistered: { origin: string; count: number }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const similar = similarSuppliers(name, suppliers);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir.");
        return;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo fornecedor</CardTitle>
          <CardDescription>Cadastre pelo nome e pela unidade (ex.: Ambev · Jaguariúna). A lista aparece em &ldquo;De onde veio&rdquo; ao cadastrar uma DPVIM, e o painel de divergências agrupa por ela.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex.: Ambev)" maxLength={80} aria-label="Nome do novo fornecedor" />
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidade (opcional)" maxLength={60} aria-label="Unidade do novo fornecedor" />
            <Button
              loading={pending}
              disabled={name.trim().length < 2}
              onClick={() => {
                run(() => createDpvimSupplierAction(name, unit.trim() ? unit : null), "Fornecedor cadastrado.");
                setName("");
                setUnit("");
              }}
            >
              Cadastrar
            </Button>
          </div>
          {similar.length > 0 && <p className="text-xs text-warning">Parecido com já cadastrado: {similar.join(", ")}. Confira para não duplicar.</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {unregistered.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle>Já usados em DPVIM e ainda não cadastrados</CardTitle>
            <CardDescription>Toque para cadastrar com o nome como está. Depois dá para editar e separar a unidade.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unregistered.map((u) => (
              <Button key={u.origin} size="sm" variant="secondary" disabled={pending} onClick={() => run(() => createDpvimSupplierAction(u.origin, null), "Fornecedor cadastrado.")}>
                {u.origin} <Badge tone="neutral">{u.count}</Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fornecedores cadastrados ({suppliers.length})</CardTitle>
          <CardDescription>Editar muda o nome nas DPVIM dele. Unir passa as DPVIM de um fornecedor para outro. Desativar tira da lista de novo cadastro, mas o histórico continua.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {suppliers.length === 0 && <li className="px-4 py-6 text-sm text-foreground-subtle">Nenhum fornecedor cadastrado ainda.</li>}
            {suppliers.map((s) => (
              <SupplierRow key={`${s.id}:${s.label}:${s.active}`} s={s} all={suppliers} busy={pending} run={run} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
