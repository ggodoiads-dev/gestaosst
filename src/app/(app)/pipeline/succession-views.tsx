import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableRow } from "@/components/ui/table";
import { CRITICALITY, ORIGIN, POSITION_STATUS, POTENTIAL, READINESS, RISK_LABEL, type PositionRisk } from "@/domain/pipeline/rules";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PositionRow } from "@/server/services/pipeline.service";
import { PositionDialog } from "./position-dialog";

const RISK_TONE: Record<PositionRisk, "danger" | "warning" | "success"> = { ALTO: "danger", MEDIO: "warning", BAIXO: "success" };
const RISK_BORDER: Record<PositionRisk, string> = { ALTO: "border-l-danger", MEDIO: "border-l-warning", BAIXO: "border-l-success" };
const RISK_TOP: Record<PositionRisk, string> = { ALTO: "border-t-danger", MEDIO: "border-t-warning", BAIXO: "border-t-success" };
const RISK_ORDER: Record<PositionRisk, number> = { ALTO: 0, MEDIO: 1, BAIXO: 2 };
const label = (list: readonly { key: string; label: string }[], key: string | null) => list.find((i) => i.key === key)?.label ?? null;
const due = (p: PositionRow) => (p.dueDate ? formatDate(p.dueDate) : p.dueNote);

export type SuccessionView = "cartoes" | "arvore" | "tabela";

export function ViewSwitch({ current, year }: { current: SuccessionView; year: number }) {
  const items: { key: SuccessionView; label: string }[] = [
    { key: "cartoes", label: "Cartões" },
    { key: "arvore", label: "Árvore" },
    { key: "tabela", label: "Tabela" },
  ];
  return (
    <div className="flex overflow-hidden rounded-md border border-border-strong text-xs font-medium" role="group" aria-label="Forma de ver">
      {items.map((i, idx) => (
        <Link key={i.key} href={`/pipeline?aba=sucessao&vis=${i.key}&ano=${year}`} className={cn("px-3 py-1.5", idx > 0 && "border-l border-border-strong", current === i.key ? "bg-foreground text-surface" : "bg-surface text-foreground hover:bg-surface-muted")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

function Successors({ p }: { p: PositionRow }) {
  const list = [
    { n: "1ª", name: p.successor1 },
    { n: "2ª", name: p.successor2 },
  ].filter((s) => s.name);
  if (list.length === 0) {
    return <p className={cn("text-sm", p.criticality === "BAIXA" ? "text-foreground-subtle" : "font-medium text-danger")}>Sem sucessor definido</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {list.map((s) => (
        <p key={s.n} className="text-sm text-foreground">
          <span className="mr-1.5 text-xs font-semibold text-foreground-subtle">{s.n}</span>
          {s.name}
        </p>
      ))}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {label(READINESS, p.readiness) && <Badge tone={p.readiness === "AGORA" ? "success" : p.readiness === "ATE_6M" ? "info" : "neutral"}>{label(READINESS, p.readiness)}</Badge>}
        {label(POTENTIAL, p.potential) && <Badge tone={p.potential === "ALTO" ? "success" : p.potential === "BAIXO" ? "danger" : "warning"}>{label(POTENTIAL, p.potential)}</Badge>}
        {label(ORIGIN, p.origin) && <Badge tone="neutral">{label(ORIGIN, p.origin)}</Badge>}
      </div>
    </div>
  );
}

/** Um cartão por cargo, os de risco alto primeiro: quem ocupa, quem pode suceder, em quanto tempo e o que falta desenvolver. */
export function SuccessionCards({ positions, names }: { positions: PositionRow[]; names: string[] }) {
  const sorted = [...positions].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.cargo.localeCompare(b.cargo));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((p) => (
        <div key={p.id} className={cn("flex flex-col gap-3 rounded-lg border border-border border-l-4 bg-surface p-4", RISK_BORDER[p.risk])}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{p.cargo}</p>
              <p className="text-xs text-foreground-subtle">{p.area ?? "Sem área"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge tone="neutral">Criticidade {label(CRITICALITY, p.criticality)?.toLowerCase()}</Badge>
              <Badge tone={RISK_TONE[p.risk]}>Risco {RISK_LABEL[p.risk].toLowerCase()}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">Ocupante</p>
              <p className="text-sm text-foreground">{p.occupant ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">Sucessores</p>
              <Successors p={p} />
            </div>
          </div>
          {(p.gap || p.action || due(p) || p.status) && (
            <div className="flex flex-col gap-1 rounded-md bg-surface-muted px-3 py-2 text-xs text-foreground-muted">
              {p.gap && (
                <p>
                  <span className="font-semibold text-foreground">Gap:</span> {p.gap}
                </p>
              )}
              {p.action && (
                <p>
                  <span className="font-semibold text-foreground">Ação:</span> {p.action}
                </p>
              )}
              {(due(p) || p.status) && (
                <p className="text-foreground-subtle">
                  {due(p) ? `Prazo ${due(p)}` : ""}
                  {due(p) && p.status ? " · " : ""}
                  {label(POSITION_STATUS, p.status) ?? ""}
                </p>
              )}
            </div>
          )}
          <div className="-mb-1 flex justify-end">
            <PositionDialog position={p} names={names} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Árvore: Plano → Área → Cargo → ocupante, sucessores e plano de ação ──

function Box({ title, lines, className, tone }: { title: string; lines?: React.ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cn("w-56 shrink-0 rounded-md border border-border bg-surface px-3 py-2 shadow-sm", tone, className)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-subtle">{title}</p>
      {lines}
    </div>
  );
}

type TreeNode = { key: string; box: React.ReactNode; children: TreeNode[] };

function Branch({ node }: { node: TreeNode }) {
  const kids = node.children;
  return (
    <div className="flex items-center">
      {node.box}
      {kids.length > 0 && (
        <>
          <span aria-hidden className="h-px w-6 shrink-0 bg-border-strong" />
          <div className="flex flex-col">
            {kids.map((child, i) => (
              <div
                key={child.key}
                className={cn(
                  "relative flex items-center py-1.5 pl-6",
                  "before:absolute before:left-0 before:top-1/2 before:h-px before:w-6 before:bg-border-strong",
                  kids.length > 1 && "after:absolute after:left-0 after:w-px after:bg-border-strong",
                  kids.length > 1 && (i === 0 ? "after:bottom-0 after:top-1/2" : i === kids.length - 1 ? "after:bottom-1/2 after:top-0" : "after:bottom-0 after:top-0"),
                )}
              >
                <Branch node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function positionNode(p: PositionRow): TreeNode {
  const children: TreeNode[] = [];
  children.push({ key: `${p.id}-occ`, children: [], box: <Box title="Ocupante atual" lines={<p className="text-[13px] font-medium text-foreground">{p.occupant ?? "—"}</p>} /> });
  const successors = [
    { n: "1ª", name: p.successor1 },
    { n: "2ª", name: p.successor2 },
  ].filter((s) => s.name);
  if (successors.length === 0) {
    children.push({
      key: `${p.id}-none`,
      children: [],
      box: <Box title="Sucessor" className={cn("border-dashed", p.criticality !== "BAIXA" && "border-danger")} lines={<p className={cn("text-[13px]", p.criticality === "BAIXA" ? "text-foreground-subtle" : "font-medium text-danger")}>Sem sucessor definido</p>} />,
    });
  } else {
    successors.forEach((s) =>
      children.push({
        key: `${p.id}-s${s.n}`,
        children: [],
        box: (
          <Box
            title={`Sucessor ${s.n}`}
            lines={
              <>
                <p className="text-[13px] font-medium text-foreground">{s.name}</p>
                <p className="mt-0.5 text-[11px] text-foreground-subtle">{[label(READINESS, p.readiness), label(POTENTIAL, p.potential)].filter(Boolean).join(" · ") || "Sem avaliação"}</p>
              </>
            }
          />
        ),
      }),
    );
  }
  if (p.gap || p.action) {
    children.push({
      key: `${p.id}-plan`,
      children: [],
      box: (
        <Box
          title="Plano de ação"
          lines={
            <>
              {p.gap && <p className="text-[12px] text-foreground">Gap: {p.gap}</p>}
              {p.action && <p className="line-clamp-3 text-[12px] text-foreground-muted">{p.action}</p>}
              {(due(p) || p.status) && (
                <p className="mt-0.5 text-[11px] text-foreground-subtle">
                  {[due(p), label(POSITION_STATUS, p.status)].filter(Boolean).join(" · ")}
                </p>
              )}
            </>
          }
        />
      ),
    });
  }
  return {
    key: p.id,
    children,
    box: (
      <Box
        title={`Cargo · criticidade ${label(CRITICALITY, p.criticality)?.toLowerCase()}`}
        className={cn("border-t-4", RISK_TOP[p.risk])}
        lines={
          <>
            <p className="text-[13px] font-semibold leading-snug text-foreground">{p.cargo}</p>
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: `var(--color-${RISK_TONE[p.risk]})` }}>
              Risco {RISK_LABEL[p.risk].toLowerCase()}
            </p>
          </>
        }
      />
    ),
  };
}

/** Árvore da esquerda para a direita. Role para o lado em telas estreitas. */
export function SuccessionTree({ positions }: { positions: PositionRow[] }) {
  const byArea = new Map<string, PositionRow[]>();
  for (const p of [...positions].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])) {
    const key = p.area ?? "Sem área";
    byArea.set(key, [...(byArea.get(key) ?? []), p]);
  }
  const high = positions.filter((p) => p.risk === "ALTO").length;
  const root: TreeNode = {
    key: "root",
    box: (
      <div className="w-48 shrink-0 rounded-md bg-brand px-3 py-3 text-brand-foreground">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-foreground/70">Plano de sucessão</p>
        <p className="text-sm font-semibold">{positions.length} cargo(s)</p>
        <p className="text-[11px] text-brand-foreground/80">{high} com risco alto</p>
      </div>
    ),
    children: [...byArea.entries()].map(([area, list]) => ({
      key: area,
      box: (
        <div className="w-44 shrink-0 rounded-md border border-border-strong bg-surface-muted px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">Área</p>
          <p className="text-sm font-bold text-foreground">{area}</p>
          <p className="text-[11px] text-foreground-muted">{list.length} cargo(s)</p>
        </div>
      ),
      children: list.map(positionNode),
    })),
  };
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface p-4">
      <p className="mb-3 text-xs text-foreground-subtle">Leia da esquerda para a direita: plano → área → cargo → ocupante, sucessores e plano de ação. A cor do topo do cargo é o risco da posição. Para editar, use a visão em Cartões.</p>
      <div className="min-w-max">
        <Branch node={root} />
      </div>
    </div>
  );
}

/** A tabela completa de antes (todas as colunas), para quem prefere ver tudo junto. */
export function SuccessionTable({ positions, names }: { positions: PositionRow[]; names: string[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cargo</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Criticidade</TableHead>
            <TableHead>Ocupante atual</TableHead>
            <TableHead>Sucessor 1ª</TableHead>
            <TableHead>Sucessor 2ª</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Prontidão</TableHead>
            <TableHead>Potencial</TableHead>
            <TableHead>Gap</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.cargo}</TableCell>
              <TableCell className="text-foreground-subtle">{p.area ?? "—"}</TableCell>
              <TableCell>{label(CRITICALITY, p.criticality) ?? "—"}</TableCell>
              <TableCell>{p.occupant ?? "—"}</TableCell>
              <TableCell>{p.successor1 ?? "—"}</TableCell>
              <TableCell>{p.successor2 ?? "—"}</TableCell>
              <TableCell className="text-foreground-subtle">{label(ORIGIN, p.origin) ?? "—"}</TableCell>
              <TableCell>{label(READINESS, p.readiness) ?? "—"}</TableCell>
              <TableCell>{label(POTENTIAL, p.potential) ?? "—"}</TableCell>
              <TableCell className="text-foreground-subtle">{p.gap ?? "—"}</TableCell>
              <TableCell className="max-w-64 text-foreground-subtle">{p.action ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-foreground-subtle">{due(p) ?? "—"}</TableCell>
              <TableCell className="text-foreground-subtle">{label(POSITION_STATUS, p.status) ?? "—"}</TableCell>
              <TableCell>
                <Badge tone={RISK_TONE[p.risk]}>{RISK_LABEL[p.risk]}</Badge>
              </TableCell>
              <TableCell>
                <PositionDialog position={p} names={names} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
