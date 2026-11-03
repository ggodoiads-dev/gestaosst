"use client";

import { Plus, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cascadeProgress, childrenOf, depthOf, descendantIds, orphanCauses, MAX_WHY_DEPTH, type CascadeBranch, type CascadeGroup } from "@/domain/termination/cascade";
import { PDCA_ACTION_STATUS_LABEL, type PdcaAction, type PdcaCause } from "@/domain/termination/pdca";
import { cn } from "@/lib/utils";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const pct = (v: number) => `${v.toLocaleString("pt-BR")}%`;

type Props = {
  /** Linha do topo: o número que a cascata explica. */
  rootLabel: string;
  groups: CascadeGroup[];
  causes: PdcaCause[];
  actions: PdcaAction[];
  onCauses: (next: PdcaCause[]) => void;
  onActions: (next: PdcaAction[]) => void;
};

/** Cascata do Plan: número → ramos dos dados → "por quê?" (até 5 níveis) → causa raiz → ações. Tudo editável; salva junto com o PDCA. */
export function CauseCascade({ rootLabel, groups, causes, actions, onCauses, onActions }: Props) {
  const branchIds = new Set(groups.flatMap((g) => g.branches.map((b) => b.id)));
  const actionCauseIds = new Set(actions.map((a) => a.causeId).filter((x): x is string => !!x));
  const progress = cascadeProgress(groups, causes, actionCauseIds);
  const loose = orphanCauses(causes, branchIds);

  const addCause = (parentId: string | null) => onCauses([...causes, { id: newId(), text: "", evidence: "", parentId, root: false }]);
  const patchCause = (id: string, patch: Partial<PdcaCause>) => onCauses(causes.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCause = (id: string) => {
    const gone = descendantIds(causes, id);
    onCauses(causes.filter((c) => !gone.has(c.id)));
    onActions(actions.map((a) => (a.causeId && gone.has(a.causeId) ? { ...a, causeId: null } : a)));
  };
  const addAction = (cause: PdcaCause) => onActions([...actions, { id: newId(), what: "", why: cause.text, who: "", due: "", status: "PENDENTE", note: "", causeId: cause.id }]);
  const patchAction = (id: string, patch: Partial<PdcaAction>) => onActions(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeAction = (id: string) => onActions(actions.filter((a) => a.id !== id));

  // Funções de renderização (e não componentes): componente definido aqui dentro seria recriado a cada tecla e o campo perderia o foco.
  const renderCause = (cause: PdcaCause, hint?: string): React.ReactNode => {
    const depth = depthOf(causes, cause.id);
    const kids = childrenOf(causes, cause.id);
    const mine = actions.filter((a) => a.causeId === cause.id);
    return (
      <div key={cause.id} className={cn("flex flex-col gap-2 rounded-md border p-3", cause.root ? "border-accent bg-accent-soft" : "border-border bg-surface")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={cause.root ? "info" : "neutral"}>{cause.root ? `Causa raiz · por quê? ${depth}` : `Por quê? ${depth}`}</Badge>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-foreground-muted">
            <input type="checkbox" checked={!!cause.root} onChange={(e) => patchCause(cause.id, { root: e.target.checked })} />É a causa raiz
          </label>
          <Button size="icon" variant="ghost" onClick={() => removeCause(cause.id)} aria-label="Remover causa e o que está abaixo dela">
            <Trash2 className="size-4" />
          </Button>
        </div>
        <Textarea rows={2} value={cause.text} onChange={(e) => patchCause(cause.id, { text: e.target.value })} placeholder={hint ?? "Por que isso acontece?"} maxLength={600} />
        <Input value={cause.evidence} onChange={(e) => patchCause(cause.id, { evidence: e.target.value })} placeholder="Evidência (entrevista, dado, observação)" maxLength={600} />

        {mine.map((a) => (
          <div key={a.id} className="grid grid-cols-1 gap-2 rounded-md bg-surface-muted p-2 sm:grid-cols-[1fr_10rem_9rem_auto]">
            <Input value={a.what} onChange={(e) => patchAction(a.id, { what: e.target.value })} placeholder="Ação: o que será feito para atacar esta causa" maxLength={600} />
            <Input value={a.who} onChange={(e) => patchAction(a.id, { who: e.target.value })} placeholder="Quem" maxLength={120} />
            <Input type="date" value={a.due} onChange={(e) => patchAction(a.id, { due: e.target.value })} aria-label="Prazo" />
            <div className="flex items-center gap-2">
              <Badge tone={a.status === "CONCLUIDA" ? "success" : a.status === "EM_ANDAMENTO" ? "warning" : "neutral"}>{PDCA_ACTION_STATUS_LABEL[a.status]}</Badge>
              <Button size="icon" variant="ghost" onClick={() => removeAction(a.id)} aria-label="Remover ação">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          {depth < MAX_WHY_DEPTH && (
            <Button size="sm" variant="secondary" onClick={() => addCause(cause.id)}>
              <Plus className="size-3.5" /> Por quê?
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => addAction(cause)}>
            <Target className="size-3.5" /> Ação para esta causa
          </Button>
        </div>

        {kids.length > 0 && (
          <div className="ml-3 flex flex-col gap-2 border-l-2 border-border pl-3">
            {kids.map((k) => renderCause(k))}
          </div>
        )}
      </div>
    );
  };

  const renderBranch = (branch: CascadeBranch): React.ReactNode => {
    const kids = childrenOf(causes, branch.id);
    return (
      <div key={branch.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-foreground">{branch.label}</p>
          {branch.pct !== null && (
            <p className="text-sm tabular-nums text-foreground-muted">
              {branch.count !== null ? `${branch.count} · ` : ""}
              <span className="font-semibold text-foreground">{pct(branch.pct)}</span> {branch.of}
            </p>
          )}
        </div>
        {branch.pct !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(Math.max(branch.pct, 2), 100)}%` }} />
          </div>
        )}
        {branch.facts.map((f) => (
          <p key={f} className="text-xs text-foreground-muted">
            {f}
          </p>
        ))}
        {branch.prompts.length > 0 && (
          <details className="text-xs text-foreground-subtle">
            <summary className="cursor-pointer select-none">Perguntas para investigar o porquê</summary>
            <ul className="mt-1 list-disc pl-4">
              {branch.prompts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </details>
        )}
        {kids.length > 0 && (
          <div className="ml-3 flex flex-col gap-2 border-l-2 border-border pl-3">
            {kids.map((k) => renderCause(k, branch.prompts[0]))}
          </div>
        )}
        <div>
          <Button size="sm" variant="secondary" onClick={() => addCause(branch.id)}>
            <Plus className="size-3.5" /> Por quê?
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Cascata de causas — do número até a causa raiz</p>
        <p className="text-xs text-foreground-subtle">
          O SIGO separa as saídas em ramos (como, por que, quando e onde saíram). Em cada ramo relevante pergunte “por quê?” até chegar na causa raiz, marque-a e crie a ação que a ataca. Ex.: 38% saíram por benefícios → por quê? o plano de saúde só vale depois de 90 dias → por quê? regra do contrato → ação: negociar carência zero.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="neutral">{progress.investigated} de {progress.branches} ramos investigados</Badge>
        <Badge tone="info">{progress.rootCauses} causa(s) raiz</Badge>
        {progress.rootsWithoutAction > 0 && <Badge tone="warning">{progress.rootsWithoutAction} causa raiz sem ação</Badge>}
      </div>

      <div className="rounded-md bg-surface-muted px-3 py-2 text-sm font-medium text-foreground">{rootLabel}</div>

      {groups.length === 0 && <p className="text-sm text-foreground-subtle">Sem saídas na janela para abrir ramos. Você ainda pode registrar causas livres abaixo.</p>}

      {groups.map((g, idx) => (
        <details key={g.id} open={idx < 2 || g.branches.some((b) => childrenOf(causes, b.id).length > 0)} className="group rounded-md">
          <summary className="cursor-pointer select-none py-1">
            <span className="text-sm font-semibold text-foreground">{g.title}</span>
            <span className="ml-2 text-xs text-foreground-subtle">{g.branches.length} ramo(s)</span>
          </summary>
          <p className="mb-2 text-xs text-foreground-subtle">{g.note}</p>
          <div className="ml-1 flex flex-col gap-2 border-l-2 border-border pl-3">
            {g.branches.map((b) => renderBranch(b))}
          </div>
        </details>
      ))}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Outras causas</p>
        <p className="text-xs text-foreground-subtle">Causas que não saem direto dos números (mudança de política, decisão da empresa, algo que você observou) ou que ficaram sem ramo.</p>
        {loose.map((c) => renderCause(c))}
        <div>
          <Button variant="secondary" onClick={() => addCause(null)}>
            <Plus className="size-4" /> Adicionar causa
          </Button>
        </div>
      </div>
    </div>
  );
}
