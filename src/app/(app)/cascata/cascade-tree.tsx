"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import { formatCascadeValue } from "@/domain/cascade/status";
import type { CascadeTreeNode } from "@/server/services/cascade.service";
import { DeleteNodeDialog, NodeDialog, ValueDialog } from "./cascade-dialogs";

type Owners = { id: string; name: string }[];
type Filter = "todos" | "fail" | "priority" | "noiv";

const STATUS = {
  OK: { label: "Bateu a meta", dot: "bg-success", text: "text-success" },
  FAIL: { label: "Não bateu", dot: "bg-danger", text: "text-danger" },
  NO_DATA: { label: "Sem resultado", dot: "bg-border-strong", text: "text-foreground-subtle" },
  NO_TARGET: { label: "Sem meta", dot: "bg-border-strong", text: "text-foreground-subtle" },
} as const;

const COLS = "md:grid md:grid-cols-[minmax(0,1fr)_96px_104px_84px_124px_130px_132px] md:items-center md:gap-x-3";
const INDENT = 22;

function monthShort(key: string) {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
}

function countDescendants(node: CascadeTreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function matches(ic: CascadeTreeNode, filter: Filter) {
  if (filter === "fail") return ic.status === "FAIL";
  if (filter === "priority") return ic.status === "FAIL" && ic.impact === "ALTO";
  if (filter === "noiv") return ic.ivRollup === "NONE";
  return true;
}

type Row = { node: CascadeTreeNode; depth: number; guides: boolean[]; isLast: boolean };

export function CascadeTree({ roots, periodKey, canManage, owners }: { roots: CascadeTreeNode[]; periodKey: string; canManage: boolean; owners: Owners }) {
  const sonho = roots.find((r) => r.kind === "SONHO") ?? roots[0];
  const [filter, setFilter] = useState<Filter>("todos");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const summary = sonho.summary ?? { total: 0, ok: 0, fail: 0, noData: 0, withoutIv: 0 };

  const allIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: CascadeTreeNode) => {
      if (n.children.length > 0) ids.push(n.id);
      n.children.forEach(walk);
    };
    walk(sonho);
    return ids;
  }, [sonho]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const visit = (node: CascadeTreeNode, depth: number, guides: boolean[], isLast: boolean) => {
      out.push({ node, depth, guides, isLast });
      // Pilares e o sonho ficam sempre abertos; IC e IV abrem ao clicar.
      const expanded = node.kind === "SONHO" || node.kind === "PILAR" || open.has(node.id);
      if (!expanded) return;
      const children = node.children.filter((c) => (c.kind === "IC" ? matches(c, filter) : true));
      children.forEach((child, i) => visit(child, depth + 1, [...guides, !isLast], i === children.length - 1));
    };
    const pilares = sonho.kind === "SONHO" ? sonho.children : roots;
    out.push({ node: sonho, depth: 0, guides: [], isLast: false });
    const shown = pilares.filter((p) => filter === "todos" || p.children.some((c) => c.kind === "IC" && matches(c, filter)));
    shown.forEach((p, i) => visit(p, 1, [false], i === shown.length - 1));
    return out;
  }, [sonho, roots, open, filter]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Como ler */}
      <section className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <h2 className="text-sm font-semibold text-foreground">Como ler esta tela</h2>
        <div className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] text-foreground-muted lg:grid-cols-2">
          <p>
            <strong className="text-foreground">Sonho → Pilar → IC → IV.</strong> A tela é uma árvore: cada linha abre nas linhas que estão logo abaixo dela,
            com um recuo maior.
          </p>
          <p>
            <strong className="text-foreground">IC (Item de Controle) = O QUÊ.</strong> É a meta que a unidade quer fechar: o resultado.
          </p>
          <p>
            <strong className="text-foreground">IV (Item de Verificação) = COMO.</strong> É o que a rotina precisa fazer para o IC fechar. Um IV pode se abrir em
            outros IVs, até chegar na pessoa responsável.
          </p>
          <p>
            <strong className="text-foreground">Para abrir o COMO de um IC, clique na linha dele.</strong>{" "}
            <span className="whitespace-nowrap"><Dot className="bg-success" /> bateu a meta</span> ·{" "}
            <span className="whitespace-nowrap"><Dot className="bg-danger" /> não bateu</span> ·{" "}
            <span className="whitespace-nowrap"><Dot className="bg-border-strong" /> sem resultado ou sem meta</span> ·{" "}
            <span className="whitespace-nowrap"><Zap className="inline size-3 text-accent" /> valor calculado pelo SIGO</span>
          </p>
        </div>
      </section>

      {/* Resumo e filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-muted">
          <strong className="text-foreground">{summary.total} ICs</strong>:{" "}
          <span className="text-success">{summary.ok} bateram a meta</span> · <span className="text-danger">{summary.fail} não bateram</span> · {summary.noData} sem
          resultado · <span className="text-warning">{summary.withoutIv} ainda sem IVs</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-foreground-subtle">
            Mostrar
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
            >
              <option value="todos">Todos os ICs</option>
              <option value="fail">Só os que não bateram a meta</option>
              <option value="priority">Prioridade máxima (alto impacto que não bateu)</option>
              <option value="noiv">Sem IVs (sem desdobramento)</option>
            </select>
          </label>
          <button type="button" onClick={() => setOpen(new Set(allIds))} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
            Abrir tudo
          </button>
          <button type="button" onClick={() => setOpen(new Set())} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
            Fechar tudo
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className={cn("hidden border-b border-border-strong bg-surface-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle", COLS, "md:grid")}>
          <span>Item</span>
          <span>Meta</span>
          <span>Resultado</span>
          <span>Atingimento</span>
          <span>Situação</span>
          <span>Responsável</span>
          <span />
        </div>
        {rows.map((row) => (
          <TreeRow
            key={row.node.id}
            row={row}
            expanded={open.has(row.node.id)}
            onToggle={() => toggle(row.node.id)}
            periodKey={periodKey}
            canManage={canManage}
            owners={owners}
          />
        ))}
        {rows.length <= 1 && <p className="px-4 py-8 text-center text-sm text-foreground-subtle">Nenhum IC com esse filtro.</p>}
      </div>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("mr-1 inline-block size-2.5 rounded-full align-middle", className)} />;
}

function TreeRow({ row, expanded, onToggle, periodKey, canManage, owners }: { row: Row; expanded: boolean; onToggle: () => void; periodKey: string; canManage: boolean; owners: Owners }) {
  const { node, depth } = row;
  const measured = node.kind === "IC" || node.kind === "IV";
  const st = STATUS[node.status];
  const hasChildren = node.children.length > 0;
  const clickable = node.kind === "IC" || node.kind === "IV";

  // Hierarquia pelo recuo (sem linhas de ligação, que poluíam): IC com faixa colorida de status, IV levemente cinza e mais recuado.
  const paddingLeft = 12 + depth * INDENT;

  if (node.kind === "SONHO") {
    return (
      <div className="border-b border-border-strong bg-brand px-3 py-3 text-brand-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-foreground/70">Sonho</p>
        <p className="text-base font-semibold">{node.name}</p>
      </div>
    );
  }

  if (node.kind === "PILAR") {
    const s = node.summary;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2" style={{ paddingLeft }}>
        <p className="text-sm font-semibold text-foreground">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">Pilar</span>
          {node.name}
        </p>
        <div className="flex items-center gap-3">
          {s && (
            <p className="text-xs text-foreground-muted">
              {s.total} ICs · <span className="text-success">{s.ok} bateram</span> · <span className="text-danger">{s.fail} não bateram</span>
              {s.withoutIv > 0 && <span className="text-warning"> · {s.withoutIv} sem IVs</span>}
            </p>
          )}
          {canManage && (
            <NodeDialog
              mode="create-ic"
              parentId={node.id}
              owners={owners}
              trigger={
                <button type="button" className="inline-flex items-center gap-1 rounded border border-border-strong bg-surface px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted">
                  <Plus className="size-3.5" /> Novo IC
                </button>
              }
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={cn(
          "relative border-l-4 px-3 py-2.5",
          node.kind === "IC" ? (node.status === "OK" ? "border-l-success" : node.status === "FAIL" ? "border-l-danger" : "border-l-border-strong") : "border-l-transparent bg-surface-muted/40",
          COLS,
          clickable && hasChildren && "cursor-pointer hover:bg-surface-muted",
        )}
        style={{ paddingLeft }}
        onClick={(e) => {
          if (!hasChildren) return;
          if ((e.target as HTMLElement).closest("button, a, [role=dialog]")) return;
          onToggle();
        }}
      >
        {/* item */}
        <div className="flex min-w-0 items-start gap-2 pl-3">
          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center text-foreground-subtle", !hasChildren && "opacity-0")}>
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </span>
          <div className="min-w-0">
            <p className="break-words text-sm text-foreground">
              <span
                className={cn(
                  "mr-2 inline-block rounded-sm px-1.5 py-px align-middle text-[10px] font-bold tracking-wide",
                  node.kind === "IC" ? "bg-foreground text-surface" : "border border-border-strong text-foreground-muted",
                )}
              >
                {node.kind === "IC" ? "IC · O QUÊ" : "IV · COMO"}
              </span>
              <span className={cn(node.kind === "IC" && "font-semibold")}>{node.name}</span>
              {node.kind === "IC" && node.impact === "ALTO" && <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">· alto impacto</span>}
            </p>
            {node.description && <p className="mt-0.5 text-xs text-foreground-subtle">{node.description}</p>}
            {node.kind === "IC" && !hasChildren && <p className="mt-0.5 text-xs text-warning">Ainda sem IVs: falta abrir o COMO desta meta.</p>}
            {node.reviewNote && <p className="mt-0.5 text-xs text-warning">Conferir: {node.reviewNote}</p>}
          </div>
        </div>

        {measured && (
          <>
            <Cell label="Meta">
              <span className="tabular-nums text-foreground">
                {node.polarity === "LOWER" && node.target !== null ? "≤ " : ""}
                {formatCascadeValue(node.unit, node.target)}
              </span>
              {node.pace === "YEAR" && node.target !== null && <span className="block text-[11px] text-foreground-subtle">no ano</span>}
              {node.pace === "MONTH" && node.target !== null && <span className="block text-[11px] text-foreground-subtle">no mês</span>}
            </Cell>
            <Cell label="Resultado">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                {formatCascadeValue(node.unit, node.value)}
                {node.valueSource === "AUTO" && <Zap className="size-3 text-accent" aria-label="Calculado pelo SIGO" />}
              </span>
              {node.valueSource === "ANTERIOR" && node.valuePeriod && <span className="block text-[11px] text-foreground-subtle">de {monthShort(node.valuePeriod)}</span>}
            </Cell>
            <Cell label="Atingimento">
              <span className="tabular-nums text-foreground-muted">{node.progress === null ? "—" : `${Math.round(node.progress * 100)}%`}</span>
            </Cell>
            <Cell label="Situação">
              <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", st.text)}>
                <Dot className={cn(st.dot, "mr-0")} />
                {st.label}
              </span>
            </Cell>
            <Cell label="Responsável">
              <span className="text-[13px] text-foreground-muted">{node.owner ? formatPersonName(node.owner.name) : "—"}</span>
            </Cell>
            <div className="mt-1 flex items-center justify-end gap-0.5 md:mt-0">
              {canManage && <RowActions node={node} periodKey={periodKey} owners={owners} />}
            </div>
          </>
        )}
      </div>

      {expanded && node.kind === "IC" && node.diagnosis && (
        <div className="border-t border-border bg-surface-muted px-3 py-2 text-[13px]" style={{ paddingLeft: paddingLeft + 34 }}>
          <span className="font-semibold text-foreground">Leitura: {node.diagnosis.title}.</span>{" "}
          <span className="text-foreground-muted">{node.diagnosis.text}</span>
        </div>
      )}
    </div>
  );
}

/** Célula com o rótulo da coluna visível só no celular (no computador o rótulo está no cabeçalho). */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-baseline gap-2 text-sm md:mt-0 md:block">
      <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-foreground-subtle md:hidden">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function RowActions({ node, periodKey, owners }: { node: CascadeTreeNode; periodKey: string; owners: Owners }) {
  const icon = "grid size-7 place-items-center rounded text-foreground-subtle hover:bg-surface hover:text-foreground";
  return (
    <>
      <ValueDialog
        nodeId={node.id}
        nodeName={node.name}
        periodKey={periodKey}
        currentValue={node.valuePeriod === periodKey ? node.value : null}
        isAuto={node.valueSource === "AUTO"}
        trigger={<button type="button" className="rounded border border-border-strong bg-surface px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted">Atualizar</button>}
      />
      <NodeDialog
        mode="create-iv"
        parentId={node.id}
        owners={owners}
        trigger={<button type="button" aria-label="Adicionar IV (como)" title="Adicionar IV (como)" className={icon}><Plus className="size-4" /></button>}
      />
      <NodeDialog
        mode="edit"
        node={{ id: node.id, name: node.name, description: node.description, unit: node.unit, polarity: node.polarity, pace: node.pace, target: node.target, ownerId: node.owner?.id ?? null, reviewNote: node.reviewNote }}
        owners={owners}
        trigger={<button type="button" aria-label="Editar" title="Editar" className={icon}><Pencil className="size-4" /></button>}
      />
      <DeleteNodeDialog
        nodeId={node.id}
        nodeName={node.name}
        childCount={countDescendants(node)}
        trigger={<button type="button" aria-label="Excluir" title="Excluir" className={cn(icon, "hover:text-danger")}><Trash2 className="size-4" /></button>}
      />
    </>
  );
}
