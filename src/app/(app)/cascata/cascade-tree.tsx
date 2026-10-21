"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Flame, GitBranch, Pencil, Plus, Target, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName, initials } from "@/lib/format-name";
import { formatCascadeValue } from "@/domain/cascade/status";
import type { CascadeTreeNode } from "@/server/services/cascade.service";
import { DeleteNodeDialog, NodeDialog, ValueDialog } from "./cascade-dialogs";

type Owners = { id: string; name: string }[];
type Filter = "todos" | "fail" | "priority" | "noiv";

const STATUS = {
  OK: { label: "Bateu", chip: "bg-success-soft text-success", bar: "bg-success", stripe: "bg-success", text: "text-success" },
  FAIL: { label: "Não bateu", chip: "bg-danger-soft text-danger", bar: "bg-danger", stripe: "bg-danger", text: "text-danger" },
  NO_DATA: { label: "Sem resultado", chip: "bg-neutral-soft text-foreground-muted", bar: "bg-border-strong", stripe: "bg-border-strong", text: "text-foreground-subtle" },
  NO_TARGET: { label: "Sem meta", chip: "bg-neutral-soft text-foreground-muted", bar: "bg-border-strong", stripe: "bg-border-strong", text: "text-foreground-subtle" },
} as const;

const SOURCE_LABEL = { MANUAL: "digitado", IMPORT: "planilha", AUTO: "automático (SIGO)", ANTERIOR: "último resultado" } as const;

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

export function CascadeTree({ roots, periodKey, canManage, owners }: { roots: CascadeTreeNode[]; periodKey: string; canManage: boolean; owners: Owners }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const sonho = roots.find((r) => r.kind === "SONHO") ?? roots[0];
  const pilares = sonho.kind === "SONHO" ? sonho.children : roots;
  const summary = sonho.summary ?? { total: 0, ok: 0, fail: 0, noData: 0, withoutIv: 0 };
  const priority = useMemo(() => {
    let n = 0;
    const walk = (node: CascadeTreeNode) => {
      if (node.kind === "IC" && matches(node, "priority")) n++;
      node.children.forEach(walk);
    };
    walk(sonho);
    return n;
  }, [sonho]);
  const pctOk = summary.total === 0 ? 0 : Math.round((summary.ok / summary.total) * 100);

  const tiles: { key: Filter; label: string; value: number; tone: string; ring: string }[] = [
    { key: "todos", label: "ICs no total", value: summary.total, tone: "text-foreground", ring: "ring-accent" },
    { key: "fail", label: "Não bateram", value: summary.fail, tone: "text-danger", ring: "ring-danger" },
    { key: "priority", label: "Prioridade máxima", value: priority, tone: "text-danger", ring: "ring-danger" },
    { key: "noiv", label: "Sem IVs (sem desdobramento)", value: summary.withoutIv, tone: "text-warning", ring: "ring-warning" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Sonho + panorama */}
      <section className="overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand via-brand to-accent/70 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 ring-4 ring-white/10">
              <Target className="size-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">Sonho</p>
              <h2 className="text-xl font-bold leading-tight">{sonho.name}</h2>
            </div>
          </div>
          <div className="min-w-56 flex-1 sm:max-w-sm">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/80">ICs que bateram a meta</span>
              <span className="text-2xl font-bold tabular-nums">{pctOk}%</span>
            </div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="bg-success" style={{ width: `${summary.total ? (summary.ok / summary.total) * 100 : 0}%` }} />
              <div className="bg-danger" style={{ width: `${summary.total ? (summary.fail / summary.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-white/70">
              {summary.ok} bateram · {summary.fail} não bateram · {summary.noData} sem resultado
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(filter === t.key ? "todos" : t.key)}
            aria-pressed={filter === t.key}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl border bg-surface px-3.5 py-3 text-left transition hover:bg-surface-muted",
              filter === t.key ? cn("border-transparent ring-2", t.ring) : "border-border",
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-2xl font-bold tabular-nums leading-none", t.tone)}>
              {t.key === "priority" && <Flame className="size-5" />}
              {t.value}
            </span>
            <span className="text-xs text-foreground-subtle">{t.label}</span>
          </button>
        ))}
      </div>

      {pilares.map((pilar) => (
        <PilarSection key={pilar.id} pilar={pilar} filter={filter} periodKey={periodKey} canManage={canManage} owners={owners} />
      ))}
    </div>
  );
}

function PilarSection({ pilar, filter, periodKey, canManage, owners }: { pilar: CascadeTreeNode; filter: Filter; periodKey: string; canManage: boolean; owners: Owners }) {
  const ics = pilar.children.filter((c) => c.kind === "IC" && matches(c, filter));
  const s = pilar.summary ?? { total: 0, ok: 0, fail: 0, noData: 0, withoutIv: 0 };
  if (filter !== "todos" && ics.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-accent/30 pb-2">
        <h3 className="text-sm font-bold tracking-wide text-accent">{pilar.name}</h3>
        <div className="flex h-2 w-40 overflow-hidden rounded-full bg-neutral-soft" aria-hidden>
          <div className="bg-success" style={{ width: `${s.total ? (s.ok / s.total) * 100 : 0}%` }} />
          <div className="bg-danger" style={{ width: `${s.total ? (s.fail / s.total) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-foreground-subtle">
          <strong className="text-success">{s.ok}</strong> bateram · <strong className="text-danger">{s.fail}</strong> não bateram
          {s.noData > 0 && <> · {s.noData} sem resultado</>}
          {s.withoutIv > 0 && <> · <span className="text-warning">{s.withoutIv} sem IVs</span></>}
        </p>
        {canManage && (
          <span className="ml-auto">
            <NodeDialog
              mode="create-ic"
              parentId={pilar.id}
              owners={owners}
              trigger={
                <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
                  <Plus className="size-3.5" /> Novo IC
                </button>
              }
            />
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {ics.map((ic) => (
          <IcCard key={ic.id} ic={ic} periodKey={periodKey} canManage={canManage} owners={owners} />
        ))}
      </div>
    </section>
  );
}

function IcCard({ ic, periodKey, canManage, owners }: { ic: CascadeTreeNode; periodKey: string; canManage: boolean; owners: Owners }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[ic.status];
  const ivCount = countDescendants(ic);

  return (
    <article className={cn("flex overflow-hidden rounded-xl border bg-surface shadow-sm", ic.status === "FAIL" ? "border-danger/30" : "border-border", open && "lg:col-span-2")}>
      <div className={cn("w-1.5 shrink-0", st.stripe)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warning">IC · O QUÊ</span>
                {ic.impact === "ALTO" && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger">ALTO IMPACTO</span>}
              </div>
              <h4 className="mt-1 break-words text-base font-semibold leading-snug text-foreground">{ic.name}</h4>
              {ic.owner && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground-subtle">
                  <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">{initials(ic.owner.name)}</span>
                  {formatPersonName(ic.owner.name)}
                </p>
              )}
            </div>
            {canManage && <Actions node={ic} periodKey={periodKey} owners={owners} />}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                Resultado{ic.valueSource === "ANTERIOR" && ic.valuePeriod ? ` · ${monthShort(ic.valuePeriod)}` : ""}
              </p>
              <p className={cn("flex items-center gap-1.5 text-3xl font-bold tabular-nums leading-none", st.text)}>
                {formatCascadeValue(ic.unit, ic.value)}
                {ic.valueSource === "AUTO" && <Zap className="size-4 text-accent" aria-label="Automático (SIGO)" />}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">Meta{ic.pace === "YEAR" ? " do ano" : ic.pace === "MONTH" ? " do mês" : ""}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {ic.polarity === "LOWER" && ic.target !== null ? "≤ " : ""}
                {formatCascadeValue(ic.unit, ic.target)}
              </p>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.chip)}>{st.label}</span>
          </div>

          <Progress node={ic} />

          {ic.diagnosis && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                ic.diagnosis.tone === "success" && "bg-success-soft text-success",
                ic.diagnosis.tone === "warning" && "bg-warning-soft text-warning",
                ic.diagnosis.tone === "danger" && "bg-danger-soft text-danger",
                ic.diagnosis.tone === "neutral" && "bg-surface-muted text-foreground-muted",
              )}
            >
              <strong>{ic.diagnosis.title}.</strong> {ic.diagnosis.text}
            </p>
          )}
          {ic.reviewNote && <p className="rounded-lg bg-warning-soft px-3 py-1.5 text-[11px] text-warning">Conferir: {ic.reviewNote}</p>}
          {ic.valueSource && ic.valueSource !== "AUTO" && ic.note && (
            <p className="text-[11px] text-foreground-subtle">
              {SOURCE_LABEL[ic.valueSource]} — {ic.note}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={ic.children.length === 0}
          className={cn(
            "flex items-center justify-between border-t border-border px-3.5 py-2 text-xs font-medium",
            ic.children.length > 0 ? "text-accent hover:bg-accent-soft" : "text-foreground-subtle",
          )}
        >
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-3.5" />
            {ic.children.length > 0 ? `COMO: ${ivCount} IV${ivCount > 1 ? "s" : ""} (processo que fecha a meta)` : "Sem IVs — abra o COMO desta meta"}
          </span>
          {ic.children.length > 0 && <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />}
        </button>

        {open && ic.children.length > 0 && (
          <div className="border-t border-border bg-surface-muted p-3.5">
            <IvList nodes={ic.children} periodKey={periodKey} canManage={canManage} owners={owners} />
          </div>
        )}
      </div>
    </article>
  );
}

/** IVs com linhas de ligação, como numa árvore genealógica. */
function IvList({ nodes, periodKey, canManage, owners }: { nodes: CascadeTreeNode[]; periodKey: string; canManage: boolean; owners: Owners }) {
  return (
    <ul className="ml-2 flex flex-col gap-2 border-l-2 border-border-strong pl-4">
      {nodes.map((node) => (
        <IvNode key={node.id} node={node} periodKey={periodKey} canManage={canManage} owners={owners} />
      ))}
    </ul>
  );
}

function IvNode({ node, periodKey, canManage, owners }: { node: CascadeTreeNode; periodKey: string; canManage: boolean; owners: Owners }) {
  const [open, setOpen] = useState(node.children.some((c) => c.status === "FAIL"));
  const st = STATUS[node.status];
  const hasChildren = node.children.length > 0;

  return (
    <li className="relative before:absolute before:-left-4 before:top-5 before:h-0.5 before:w-4 before:bg-border-strong">
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <span className={cn("size-2.5 shrink-0 rounded-full", st.stripe)} aria-hidden />
          <div className="min-w-0 flex-1 basis-48">
            <p className="break-words text-sm font-medium text-foreground">
              <span className="mr-1.5 rounded bg-neutral-soft px-1 py-0.5 text-[9px] font-bold tracking-wide text-foreground-muted">IV</span>
              {node.name}
            </p>
            {node.description && <p className="text-[11px] text-foreground-subtle">{node.description}</p>}
            {node.owner && <p className="text-[11px] text-foreground-subtle">Responsável: {formatPersonName(node.owner.name)}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 font-semibold tabular-nums text-foreground">
                {formatCascadeValue(node.unit, node.value)}
                {node.valueSource === "AUTO" && <Zap className="size-3 text-accent" aria-label="Automático (SIGO)" />}
              </p>
              <p className="text-[11px] text-foreground-subtle">
                meta {node.polarity === "LOWER" && node.target !== null ? "≤ " : ""}
                {formatCascadeValue(node.unit, node.target)}
              </p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st.chip)}>{st.label}</span>
          </div>
          {canManage && <Actions node={node} periodKey={periodKey} owners={owners} compact />}
          {hasChildren && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fechar" : "Abrir"}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-accent hover:bg-accent-soft"
            >
              {node.children.length} <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>
        {node.progress !== null && (
          <div className="px-3 pb-2">
            <Progress node={node} thin />
          </div>
        )}
      </div>
      {open && hasChildren && (
        <div className="mt-2">
          <IvList nodes={node.children} periodKey={periodKey} canManage={canManage} owners={owners} />
        </div>
      )}
    </li>
  );
}

function Progress({ node, thin }: { node: CascadeTreeNode; thin?: boolean }) {
  if (node.progress === null) return null;
  const st = STATUS[node.status];
  return (
    <div>
      <div className={cn("overflow-hidden rounded-full bg-neutral-soft", thin ? "h-1" : "h-2")}>
        <div className={cn("h-full rounded-full transition-all", st.bar)} style={{ width: `${Math.max(Math.round(node.progress * 100), 2)}%` }} />
      </div>
      {!thin && node.expected !== null && node.pace !== "NONE" && node.target !== null && node.expected !== node.target && (
        <p className="mt-1 text-[11px] text-foreground-subtle">Esperado até aqui: {formatCascadeValue(node.unit, node.expected)}</p>
      )}
    </div>
  );
}

function Actions({ node, periodKey, owners, compact }: { node: CascadeTreeNode; periodKey: string; owners: Owners; compact?: boolean }) {
  const icon = "grid size-7 place-items-center rounded text-foreground-subtle hover:bg-surface-muted";
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ValueDialog
        nodeId={node.id}
        nodeName={node.name}
        periodKey={periodKey}
        currentValue={node.valuePeriod === periodKey ? node.value : null}
        isAuto={node.valueSource === "AUTO"}
        trigger={<button type="button" className={cn("rounded font-medium text-accent hover:bg-accent-soft", compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs")}>Resultado</button>}
      />
      <NodeDialog
        mode="create-iv"
        parentId={node.id}
        owners={owners}
        trigger={<button type="button" aria-label="Adicionar IV" title="Adicionar IV (como)" className={icon}><Plus className="size-4" /></button>}
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
        trigger={<button type="button" aria-label="Excluir" title="Excluir" className={cn(icon, "hover:bg-danger-soft hover:text-danger")}><Trash2 className="size-4" /></button>}
      />
    </div>
  );
}
