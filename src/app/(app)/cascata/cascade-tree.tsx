"use client";

import { useState } from "react";
import { ChevronRight, Pencil, Plus, Target, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import { formatCascadeValue } from "@/domain/cascade/status";
import type { CascadeTreeNode } from "@/server/services/cascade.service";
import { DeleteNodeDialog, NodeDialog, ValueDialog } from "./cascade-dialogs";

type Owners = { id: string; name: string }[];

const STATUS_STYLE = {
  OK: { label: "Bateu", chip: "bg-success-soft text-success", bar: "bg-success" },
  FAIL: { label: "Não bateu", chip: "bg-danger-soft text-danger", bar: "bg-danger" },
  NO_DATA: { label: "Sem resultado", chip: "bg-neutral-soft text-foreground-muted", bar: "bg-neutral-soft" },
  NO_TARGET: { label: "Sem meta", chip: "bg-neutral-soft text-foreground-muted", bar: "bg-neutral-soft" },
} as const;

const KIND_STYLE = {
  SONHO: "bg-brand text-white",
  PILAR: "bg-accent-soft text-accent",
  IC: "bg-warning-soft text-warning",
  IV: "bg-neutral-soft text-foreground-muted",
} as const;

const KIND_LABEL = { SONHO: "SONHO", PILAR: "PILAR", IC: "IC · O QUÊ", IV: "IV · COMO" } as const;

const SOURCE_LABEL = { MANUAL: "digitado", IMPORT: "planilha", AUTO: "automático (SIGO)", ANTERIOR: "último resultado" } as const;

function monthShort(key: string) {
  const [y, m] = key.split("-");
  return `${m}/${y}`;
}

export function CascadeTree({ roots, periodKey, canManage, owners }: { roots: CascadeTreeNode[]; periodKey: string; canManage: boolean; owners: Owners }) {
  return (
    <div className="flex flex-col gap-3">
      {roots.map((root) => (
        <Node key={root.id} node={root} depth={0} periodKey={periodKey} canManage={canManage} owners={owners} />
      ))}
    </div>
  );
}

function Node({ node, depth, periodKey, canManage, owners }: { node: CascadeTreeNode; depth: number; periodKey: string; canManage: boolean; owners: Owners }) {
  // Sonho e pilares abertos; ICs e IVs fechados (abre o COMO sob demanda).
  const [open, setOpen] = useState(node.kind === "SONHO" || node.kind === "PILAR");
  const hasChildren = node.children.length > 0;
  const isMeasured = node.kind === "IC" || node.kind === "IV";
  const status = STATUS_STYLE[node.status];

  return (
    <div className={cn(depth > 0 && "ml-4 border-l-2 border-border pl-3")}>
      <div
        className={cn(
          "rounded-lg border bg-surface",
          node.kind === "SONHO" ? "border-brand/40" : node.kind === "IC" && node.status === "FAIL" ? "border-danger/40" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!hasChildren}
            aria-label={open ? "Fechar" : "Abrir"}
            className={cn("grid size-6 shrink-0 place-items-center rounded text-foreground-subtle", hasChildren ? "hover:bg-surface-muted" : "opacity-30")}
          >
            <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          </button>
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide", KIND_STYLE[node.kind])}>{KIND_LABEL[node.kind]}</span>
          <div className="min-w-0 flex-1 basis-56">
            <p className={cn("break-words font-medium text-foreground", node.kind === "SONHO" ? "text-base" : "text-sm")}>
              {node.kind === "SONHO" && <Target className="mr-1.5 inline size-4 text-brand" />}
              {node.name}
              {node.kind === "IC" && node.impact === "ALTO" && <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">ALTO IMPACTO</span>}
            </p>
            {node.description && <p className="text-xs text-foreground-subtle">{node.description}</p>}
            {node.owner && <p className="text-xs text-foreground-subtle">Responsável: {formatPersonName(node.owner.name)}</p>}
          </div>

          {isMeasured && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <div>
                <p className="text-foreground-subtle">Meta{node.pace === "YEAR" ? " do ano" : node.pace === "MONTH" ? " do mês" : ""}</p>
                <p className="font-semibold tabular-nums text-foreground">
                  {node.polarity === "LOWER" && node.target !== null ? "≤ " : ""}
                  {formatCascadeValue(node.unit, node.target)}
                </p>
              </div>
              <div>
                <p className="text-foreground-subtle">
                  Resultado
                  {node.valueSource === "ANTERIOR" && node.valuePeriod ? ` (${monthShort(node.valuePeriod)})` : ""}
                </p>
                <p className="flex items-center gap-1 font-semibold tabular-nums text-foreground">
                  {formatCascadeValue(node.unit, node.value)}
                  {node.valueSource === "AUTO" && <Zap className="size-3 text-accent" aria-label="Automático (SIGO)" />}
                </p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 font-medium", status.chip)}>{status.label}</span>
            </div>
          )}

          {node.summary && node.summary.total > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">{node.summary.ok} bateu</span>
              <span className="rounded-full bg-danger-soft px-2 py-0.5 font-medium text-danger">{node.summary.fail} não bateu</span>
              {node.summary.noData > 0 && <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-foreground-muted">{node.summary.noData} sem resultado</span>}
              {node.summary.withoutIv > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">{node.summary.withoutIv} sem IVs</span>}
            </div>
          )}

          {canManage && isMeasured && (
            <div className="flex shrink-0 items-center gap-0.5">
              <ValueDialog
                nodeId={node.id}
                nodeName={node.name}
                periodKey={periodKey}
                currentValue={node.valuePeriod === periodKey ? node.value : null}
                isAuto={node.valueSource === "AUTO"}
                trigger={<button type="button" className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">Resultado</button>}
              />
              <NodeDialog
                mode="create-iv"
                parentId={node.id}
                owners={owners}
                trigger={<button type="button" aria-label="Adicionar IV" title="Adicionar IV (como)" className="grid size-7 place-items-center rounded text-foreground-subtle hover:bg-surface-muted"><Plus className="size-4" /></button>}
              />
              <NodeDialog
                mode="edit"
                node={{ id: node.id, name: node.name, description: node.description, unit: node.unit, polarity: node.polarity, pace: node.pace, target: node.target, ownerId: node.owner?.id ?? null, reviewNote: node.reviewNote }}
                owners={owners}
                trigger={<button type="button" aria-label="Editar" title="Editar" className="grid size-7 place-items-center rounded text-foreground-subtle hover:bg-surface-muted"><Pencil className="size-4" /></button>}
              />
              <DeleteNodeDialog
                nodeId={node.id}
                nodeName={node.name}
                childCount={countDescendants(node)}
                trigger={<button type="button" aria-label="Excluir" title="Excluir" className="grid size-7 place-items-center rounded text-foreground-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>}
              />
            </div>
          )}
        </div>

        {isMeasured && node.progress !== null && (
          <div className="px-3 pb-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-soft">
              <div className={cn("h-full rounded-full", status.bar)} style={{ width: `${Math.max(Math.round(node.progress * 100), 2)}%` }} />
            </div>
            {node.expected !== null && node.pace !== "NONE" && node.target !== null && node.expected !== node.target && (
              <p className="mt-1 text-[11px] text-foreground-subtle">Esperado até aqui: {formatCascadeValue(node.unit, node.expected)}</p>
            )}
          </div>
        )}

        {node.kind === "IC" && node.diagnosis && (
          <div
            className={cn(
              "mx-3 mb-2.5 rounded-md px-3 py-2 text-xs",
              node.diagnosis.tone === "success" && "bg-success-soft text-success",
              node.diagnosis.tone === "warning" && "bg-warning-soft text-warning",
              node.diagnosis.tone === "danger" && "bg-danger-soft text-danger",
              node.diagnosis.tone === "neutral" && "bg-neutral-soft text-foreground-muted",
            )}
          >
            <strong>{node.diagnosis.title}.</strong> {node.diagnosis.text}
          </div>
        )}

        {node.reviewNote && (
          <p className="mx-3 mb-2.5 rounded-md bg-warning-soft px-3 py-1.5 text-[11px] text-warning">Conferir: {node.reviewNote}</p>
        )}
        {node.valueSource && node.valueSource !== "AUTO" && node.note && (
          <p className="px-3 pb-2 text-[11px] text-foreground-subtle">
            {SOURCE_LABEL[node.valueSource]} — {node.note}
          </p>
        )}
      </div>

      {open && hasChildren && (
        <div className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} periodKey={periodKey} canManage={canManage} owners={owners} />
          ))}
        </div>
      )}
    </div>
  );
}

function countDescendants(node: CascadeTreeNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}
