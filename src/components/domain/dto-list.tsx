"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";
import { formatPersonName, initials } from "@/lib/format-name";
import { classifyAnswer } from "@/domain/dto/answers";
import { getDtoActionsAction } from "@/server/actions/dto.actions";
import type { DtoItem } from "@/server/services/dto.service";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function scoreTone(score: number | null): "success" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  return score >= 90 ? "success" : score >= 70 ? "warning" : "danger";
}

function splitAnswers(answers: DtoItem["answers"]) {
  return {
    checks: answers.filter((a) => classifyAnswer(a.a) !== "text"),
    observations: answers.filter((a) => classifyAnswer(a.a) === "text"),
  };
}

type RicoAction = { title: string; detail: string; owner: string; deadline: string };

/** Ações sugeridas pelo Rico pros pontos negativos e observações do DTO (gera na 1ª abertura e guarda). */
function RicoActions({ dtoId, hasIssues }: { dtoId: string; hasIssues: boolean }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; actions: RicoAction[]; error?: string }>({
    status: hasIssues ? "loading" : "idle",
    actions: [],
  });

  useEffect(() => {
    if (!hasIssues) return;
    let cancelled = false;
    void getDtoActionsAction(dtoId).then((res) => {
      if (cancelled) return;
      setState(res.ok ? { status: "done", actions: res.actions } : { status: "error", actions: [], error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [dtoId, hasIssues]);

  if (!hasIssues) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-accent" /> Ações sugeridas pelo Rico
      </p>
      {state.status === "loading" && (
        <p className="flex items-center gap-2 text-xs text-foreground-subtle">
          <Loader2 className="size-3.5 animate-spin" /> O Rico está analisando os pontos negativos...
        </p>
      )}
      {state.status === "error" && <p className="text-xs text-foreground-subtle">{state.error}</p>}
      {state.status === "done" && state.actions.length === 0 && (
        <p className="text-xs text-foreground-subtle">Sem pontos negativos para ajustar.</p>
      )}
      {state.status === "done" && state.actions.length > 0 && (
        <>
          <ol className="flex flex-col gap-2">
            {state.actions.map((a, i) => (
              <li key={i} className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {i + 1}. {a.title}
                </p>
                <p className="mt-0.5 text-sm text-foreground-muted">{a.detail}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs text-foreground-subtle">
                  <span>Responsável: {a.owner}</span>
                  <span>·</span>
                  <span>Prazo: {a.deadline}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-foreground-subtle">Sugestão gerada por IA — a liderança avalia e decide o que aplicar.</p>
        </>
      )}
    </div>
  );
}

function DtoDetail({ item, open, onOpenChange, showCollaborator }: { item: DtoItem; open: boolean; onOpenChange: (o: boolean) => void; showCollaborator: boolean }) {
  const { checks, observations } = splitAnswers(item.answers);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>DTO — {item.activity}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {showCollaborator && (
              <div>
                <p className="text-xs text-foreground-subtle">Avaliado</p>
                <p className="font-medium">{formatPersonName(item.collaboratorName)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-foreground-subtle">Data</p>
              <p className="font-medium">{formatDate(item.date)}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Avaliador</p>
              <p className="font-medium">
                {item.evaluatorName ? formatPersonName(item.evaluatorName) : "—"}
                {item.evaluatorRole && <span className="font-normal text-foreground-subtle"> · {formatPersonName(item.evaluatorRole)}</span>}
              </p>
            </div>
            {item.operation && (
              <div>
                <p className="text-xs text-foreground-subtle">Operação</p>
                <p className="font-medium">{item.operation}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={scoreTone(item.scorePercent)}>
              {item.scorePercent === null ? "Sem pontuação" : `${item.scorePercent}% de conformidade`}
            </Badge>
            <span className="text-xs text-foreground-subtle">
              {item.yesCount} sim · {item.noCount} não{item.naCount > 0 ? ` · ${item.naCount} não se aplica` : ""}
            </span>
          </div>

          {checks.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {checks.map((a, i) => {
                const kind = classifyAnswer(a.a);
                return (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="text-foreground">{a.q}</span>
                    <Badge tone={kind === "yes" ? "success" : kind === "no" ? "danger" : "neutral"} className="shrink-0">
                      {kind === "yes" ? "Sim" : kind === "no" ? "Não" : "N/A"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}

          {observations.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">Observações ({observations.length})</p>
              {observations.map((a, i) => (
                <div key={i} className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
                  <p className="text-xs text-foreground-subtle">{a.q}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{a.a}</p>
                </div>
              ))}
            </div>
          )}
          <RicoActions dtoId={item.id} hasIssues={item.noCount > 0 || observations.length > 0} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de DTOs com detalhe das respostas. `showCollaborator` = visão da gestão (várias pessoas); sem ele, é o
 * "Meu Perfil" do colaborador (só os dele). */
export function DtoList({
  items,
  showCollaborator,
  withFilters = false,
}: {
  items: DtoItem[];
  showCollaborator: boolean;
  withFilters?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const activities = useMemo(() => [...new Set(items.map((i) => i.activity))].sort(), [items]);
  const shown = items.filter(
    (i) =>
      (!query || normalize(i.collaboratorName).includes(normalize(query)) || normalize(i.evaluatorName ?? "").includes(normalize(query))) &&
      (!activity || i.activity === activity),
  );
  const opened = items.find((i) => i.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {withFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar avaliado ou avaliador..."
              className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
            />
          </div>
          {activities.length > 1 && (
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              aria-label="Filtrar por atividade"
              className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
            >
              <option value="">Todas as atividades</option>
              {activities.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-foreground-subtle">Nenhum DTO encontrado.</p>
      ) : (
        <div className={cn("grid grid-cols-1 gap-2", showCollaborator && "lg:grid-cols-2")}>
          {shown.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setOpenId(i.id)}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left hover:bg-surface-muted"
            >
              {showCollaborator && (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {initials(i.collaboratorName)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {showCollaborator ? formatPersonName(i.collaboratorName) : i.activity}
                </span>
                <span className="block truncate text-xs text-foreground-subtle">
                  {showCollaborator && `${i.activity} · `}
                  {formatDate(i.date)}
                  {i.evaluatorName && ` · por ${formatPersonName(i.evaluatorName)}`}
                </span>
              </span>
              {splitAnswers(i.answers).observations.length > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-warning" title="Tem observações">
                  <MessageSquareText className="size-3.5" />
                  {splitAnswers(i.answers).observations.length}
                </span>
              )}
              <Badge tone={scoreTone(i.scorePercent)}>{i.scorePercent === null ? "—" : `${i.scorePercent}%`}</Badge>
            </button>
          ))}
        </div>
      )}

      {opened && (
        <DtoDetail item={opened} open onOpenChange={(o) => !o && setOpenId(null)} showCollaborator={showCollaborator} />
      )}
    </div>
  );
}
