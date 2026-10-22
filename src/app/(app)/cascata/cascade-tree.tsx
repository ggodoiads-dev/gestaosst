"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ChevronRight, List, Network, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import { formatCascadeValue } from "@/domain/cascade/status";
import type { CascadeTreeNode } from "@/server/services/cascade.service";
import { DeleteNodeDialog, NodeDialog, SyncSeedButton, ValueDialog, type ParentOption } from "./cascade-dialogs";

type Owners = { id: string; name: string }[];

/** Todos os lugares onde um item pode ficar (pilares, ICs e IVs), com o caminho completo na etiqueta. */
function buildParentOptions(roots: CascadeTreeNode[]): ParentOption[] {
  const out: ParentOption[] = [];
  const walk = (node: CascadeTreeNode, path: string[], ancestors: string[]) => {
    if (node.kind === "PILAR") out.push({ id: node.id, kind: "PILAR", label: node.name, ancestors });
    if (node.kind === "IC" || node.kind === "IV") out.push({ id: node.id, kind: node.kind, label: `${node.kind} · ${[...path, node.name].join(" › ")}`, ancestors });
    const nextPath = node.kind === "SONHO" ? [] : node.kind === "PILAR" ? [node.name] : [...path, node.name];
    node.children.forEach((c) => walk(c, nextPath, [...ancestors, node.id]));
  };
  roots.forEach((r) => walk(r, [], []));
  return out;
}

const ParentOptionsContext = createContext<ParentOption[]>([]);
type Filter = "todos" | "fail" | "priority" | "noiv";

const STATUS = {
  OK: { label: "Bateu a meta", dot: "bg-success", text: "text-success" },
  FAIL: { label: "Não bateu", dot: "bg-danger", text: "text-danger" },
  NO_DATA: { label: "Sem resultado", dot: "bg-border-strong", text: "text-foreground-subtle" },
  NO_TARGET: { label: "Sem meta", dot: "bg-border-strong", text: "text-foreground-subtle" },
} as const;

const COLS = "xl:grid xl:grid-cols-[minmax(0,1fr)_88px_92px_112px_80px_120px_116px_132px] xl:items-center xl:gap-x-3";
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
  const [view, setView] = useState<"arvore" | "lista">("arvore");
  const [pilarId, setPilarId] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const summary = sonho.summary ?? { total: 0, ok: 0, fail: 0, noData: 0, withoutIv: 0 };
  const parentOptions = useMemo(() => buildParentOptions(roots), [roots]);

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
    <ParentOptionsContext.Provider value={parentOptions}>
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
            <strong className="text-foreground">Para abrir o COMO de um IC, clique nele.</strong>{" "}
            <span className="whitespace-nowrap"><Dot className="bg-success" /> bateu a meta</span> ·{" "}
            <span className="whitespace-nowrap"><Dot className="bg-danger" /> não bateu</span> ·{" "}
            <span className="whitespace-nowrap"><Dot className="bg-border-strong" /> sem resultado ou sem meta</span> ·{" "}
            <span className="whitespace-nowrap"><Zap className="inline size-3 text-accent" /> valor calculado pelo SIGO</span>.{" "}<strong className="text-foreground">Mês</strong> é o resultado do mês escolhido; <strong className="text-foreground">Acumulado (YTD)</strong> é do início do ano até o mês. A situação compara o acumulado com a meta do ano.
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
          <div className="flex overflow-hidden rounded-md border border-border-strong text-xs font-medium" role="group" aria-label="Forma de ver">
            <button
              type="button"
              onClick={() => setView("arvore")}
              aria-pressed={view === "arvore"}
              className={cn("inline-flex h-8 items-center gap-1.5 px-3", view === "arvore" ? "bg-foreground text-surface" : "bg-surface text-foreground hover:bg-surface-muted")}
            >
              <Network className="size-3.5" /> Árvore
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              aria-pressed={view === "lista"}
              className={cn("inline-flex h-8 items-center gap-1.5 border-l border-border-strong px-3", view === "lista" ? "bg-foreground text-surface" : "bg-surface text-foreground hover:bg-surface-muted")}
            >
              <List className="size-3.5" /> Lista
            </button>
          </div>
          {view === "arvore" && (
            <label className="flex items-center gap-2 text-xs text-foreground-subtle">
              Pilar
              <select value={pilarId} onChange={(e) => setPilarId(e.target.value)} className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
                <option value="">Todos os pilares</option>
                {(sonho.kind === "SONHO" ? sonho.children : roots).map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </label>
          )}
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
          {canManage && (
            <NodeDialog
              mode="create"
              owners={owners}
              parentOptions={parentOptions}
              trigger={
                <button type="button" className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
                  <Plus className="size-3.5" /> Novo IC ou IV
                </button>
              }
            />
          )}
          {canManage && <SyncSeedButton />}
          <button type="button" onClick={() => setOpen(new Set(allIds))} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
            Abrir tudo
          </button>
          <button type="button" onClick={() => setOpen(new Set())} className="h-8 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-muted">
            Fechar tudo
          </button>
        </div>
      </div>

      {view === "arvore" ? (
        <Diagram sonho={sonho} roots={roots} filter={filter} pilarId={pilarId} open={open} toggle={toggle} />
      ) : (
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className={cn("hidden border-b border-border-strong bg-surface-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle", COLS, "xl:grid")}>
          <span>Item</span>
          <span>Meta</span>
          <span>Mês</span>
          <span>Acumulado (YTD)</span>
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
      )}
    </div>
    </ParentOptionsContext.Provider>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("mr-1 inline-block size-2.5 rounded-full align-middle", className)} />;
}

function TreeRow({ row, expanded, onToggle, periodKey, canManage, owners }: { row: Row; expanded: boolean; onToggle: () => void; periodKey: string; canManage: boolean; owners: Owners }) {
  const { node, depth } = row;
  const parentOptions = useContext(ParentOptionsContext);
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
              mode="create"
              presetKind="IC"
              presetParentId={node.id}
              owners={owners}
              parentOptions={parentOptions}
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
            <Cell label="Resultado do mês">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <span className={cn(node.monthValue === null ? "text-foreground-subtle" : STATUS[node.monthStatus].text)}>{formatCascadeValue(node.unit, node.monthValue)}</span>
                {node.monthSource === "AUTO" && <Zap className="size-3 text-accent" aria-label="Calculado pelo SIGO" />}
              </span>
            </Cell>
            <Cell label="Acumulado no ano (YTD)">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-foreground">
                {formatCascadeValue(node.unit, node.ytdValue)}
                {node.ytdSource === "AUTO" && <Zap className="size-3 text-accent" aria-label="Calculado pelo SIGO" />}
              </span>
              {node.ytdSource === "ANTERIOR" && node.ytdPeriod && <span className="block text-[11px] text-foreground-subtle">até {monthShort(node.ytdPeriod)}</span>}
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
            <div className="mt-1 flex items-center justify-end gap-0.5 xl:mt-0">
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
    <div className="mt-1 flex items-baseline gap-2 text-sm xl:mt-0 xl:block">
      <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-foreground-subtle xl:hidden">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function RowActions({ node, periodKey, owners }: { node: CascadeTreeNode; periodKey: string; owners: Owners }) {
  const parentOptions = useContext(ParentOptionsContext);
  const icon = "grid size-7 place-items-center rounded text-foreground-subtle hover:bg-surface hover:text-foreground";
  return (
    <>
      <ValueDialog
        nodeId={node.id}
        nodeName={node.name}
        periodKey={periodKey}
        currentMonth={node.monthValue}
        currentYtd={node.ytdPeriod === periodKey ? node.ytdValue : null}
        hasAuto={node.monthSource === "AUTO" || node.ytdSource === "AUTO"}
        trigger={<button type="button" className="rounded border border-border-strong bg-surface px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-muted">Atualizar</button>}
      />
      <NodeDialog
        mode="create"
        presetKind="IV"
        presetParentId={node.id}
        owners={owners}
        parentOptions={parentOptions}
        trigger={<button type="button" aria-label="Adicionar IV (como)" title="Adicionar IV (como)" className={icon}><Plus className="size-4" /></button>}
      />
      <NodeDialog
        mode="edit"
        parentOptions={parentOptions}
        node={{ id: node.id, kind: node.kind as "IC" | "IV", parentId: node.parentId, name: node.name, description: node.description, unit: node.unit, polarity: node.polarity, pace: node.pace, target: node.target, ownerId: node.owner?.id ?? null, reviewNote: node.reviewNote }}
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

// ---------------------------------------------------------------------------------------------------------------------
// Visão em árvore (genealógica): da esquerda para a direita — Sonho → Pilar → IC (o quê) → IV (como) → IV...
// ---------------------------------------------------------------------------------------------------------------------

const BOX_TOP = {
  OK: "border-t-success",
  FAIL: "border-t-danger",
  NO_DATA: "border-t-border-strong",
  NO_TARGET: "border-t-border-strong",
} as const;

function Diagram({
  sonho,
  roots,
  filter,
  pilarId,
  open,
  toggle,
}: {
  sonho: CascadeTreeNode;
  roots: CascadeTreeNode[];
  filter: Filter;
  pilarId: string;
  open: Set<string>;
  toggle: (id: string) => void;
}) {
  const pilares = (sonho.kind === "SONHO" ? sonho.children : roots).filter((p) => !pilarId || p.id === pilarId);
  const visible = (node: CascadeTreeNode): CascadeTreeNode[] => node.children.filter((c) => c.kind !== "IC" || matches(c, filter));
  const shown = pilares.filter((p) => filter === "todos" || p.children.some((c) => c.kind === "IC" && matches(c, filter)));

  if (shown.length === 0) return <p className="rounded-md border border-border bg-surface px-4 py-8 text-center text-sm text-foreground-subtle">Nenhum IC com esse filtro.</p>;

  // Com um pilar só, ele vira a raiz; com vários, o Sonho é a raiz.
  const root: CascadeTreeNode = pilarId || filter !== "todos" ? { ...sonho, children: shown } : sonho;

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface p-4">
      <p className="mb-3 text-xs text-foreground-subtle">
        Leia da esquerda para a direita: cada caixa abre nas caixas que saem dela. Clique em um IC ou IV para abrir ou fechar o que vem depois.
      </p>
      <div className="min-w-max">
        <Branch node={root} visible={visible} open={open} toggle={toggle} />
      </div>
    </div>
  );
}

function Branch({ node, visible, open, toggle }: { node: CascadeTreeNode; visible: (n: CascadeTreeNode) => CascadeTreeNode[]; open: Set<string>; toggle: (id: string) => void }) {
  const kids = visible(node);
  const expanded = node.kind === "SONHO" || node.kind === "PILAR" || open.has(node.id);
  return (
    <div className="flex items-center">
      <NodeBox node={node} childCount={kids.length} expanded={expanded} onToggle={() => toggle(node.id)} />
      {expanded && kids.length > 0 && (
        <>
          <span aria-hidden className="h-px w-6 shrink-0 bg-border-strong" />
          <div className="flex flex-col">
            {kids.map((child, i) => (
              <div
                key={child.id}
                className={cn(
                  "relative flex items-center py-1.5 pl-6",
                  "before:absolute before:left-0 before:top-1/2 before:h-px before:w-6 before:bg-border-strong",
                  kids.length > 1 && "after:absolute after:left-0 after:w-px after:bg-border-strong",
                  kids.length > 1 && (i === 0 ? "after:bottom-0 after:top-1/2" : i === kids.length - 1 ? "after:bottom-1/2 after:top-0" : "after:bottom-0 after:top-0"),
                )}
              >
                <Branch node={child} visible={visible} open={open} toggle={toggle} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NodeBox({ node, childCount, expanded, onToggle }: { node: CascadeTreeNode; childCount: number; expanded: boolean; onToggle: () => void }) {
  const measured = node.kind === "IC" || node.kind === "IV";
  const st = STATUS[node.status];
  const canToggle = measured && node.children.length > 0;

  if (node.kind === "SONHO") {
    return (
      <div className="w-48 shrink-0 rounded-md bg-brand px-3 py-3 text-brand-foreground">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-foreground/70">Sonho</p>
        <p className="text-sm font-semibold leading-snug">{node.name}</p>
      </div>
    );
  }
  if (node.kind === "PILAR") {
    const s = node.summary;
    return (
      <div className="w-44 shrink-0 rounded-md border border-border-strong bg-surface-muted px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">Pilar</p>
        <p className="text-sm font-bold text-foreground">{node.name}</p>
        {s && (
          <p className="mt-0.5 text-[11px] text-foreground-muted">
            <span className="text-success">{s.ok} bateram</span> · <span className="text-danger">{s.fail} não</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={
        canToggle
          ? (e) => {
              const el = e.currentTarget;
              onToggle();
              // Os filhos abrem à direita: traz a caixa clicada para o centro da área rolável para o que abriu ficar à vista.
              setTimeout(() => el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 60);
            }
          : undefined
      }
      aria-expanded={canToggle ? expanded : undefined}
      className={cn(
        "w-56 shrink-0 rounded-md border border-border border-t-4 bg-surface px-3 py-2 text-left shadow-sm",
        BOX_TOP[node.status],
        canToggle ? "cursor-pointer hover:bg-surface-muted" : "cursor-default",
      )}
    >
      <p className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-subtle">
        <span>{node.kind === "IC" ? "IC · O QUÊ" : "IV · COMO"}</span>
        {canToggle && (
          <span className="inline-flex items-center gap-0.5 text-accent">
            {childCount} <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
          </span>
        )}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{node.name}</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] text-foreground-subtle">
        <span>
          Meta
          <span className="block font-medium tabular-nums text-foreground-muted">{node.polarity === "LOWER" && node.target !== null ? "≤ " : ""}{formatCascadeValue(node.unit, node.target)}</span>
        </span>
        <span>
          Mês
          <span className={cn("flex items-center gap-0.5 font-bold tabular-nums", node.monthValue === null ? "text-foreground-subtle" : STATUS[node.monthStatus].text)}>
            {formatCascadeValue(node.unit, node.monthValue)}
            {node.monthSource === "AUTO" && <Zap className="size-3 text-accent" />}
          </span>
        </span>
        <span>
          Ano (YTD)
          <span className={cn("flex items-center gap-0.5 font-bold tabular-nums", st.text)}>
            {formatCascadeValue(node.unit, node.ytdValue)}
            {node.ytdSource === "AUTO" && <Zap className="size-3 text-accent" />}
          </span>
        </span>
      </div>
      <p className={cn("mt-1 flex items-center gap-1.5 text-[11px] font-medium", st.text)}>
        <Dot className={cn(st.dot, "mr-0 size-2")} /> {st.label}
        {node.kind === "IC" && node.impact === "ALTO" && <span className="ml-auto text-[10px] font-semibold uppercase text-foreground-subtle">alto impacto</span>}
      </p>
      {node.kind === "IC" && node.children.length === 0 && <p className="mt-1 text-[11px] text-warning">Sem IVs ainda</p>}
    </button>
  );
}
