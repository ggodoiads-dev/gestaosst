"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { JustifyChecklistItemDialog } from "@/components/domain/justify-checklist-item-dialog";
import type { TodayProgressEntry } from "@/server/services/checklist-compliance.service";

type Filter = "todos" | "faltam" | "concluidos";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function TodayProgressPanel({
  concluded,
  remaining,
  dayKey,
  canJustify,
}: {
  concluded: TodayProgressEntry[];
  remaining: TodayProgressEntry[];
  dayKey: string;
  canJustify: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [area, setArea] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const areas = useMemo(
    () => [...new Set([...concluded, ...remaining].map((c) => c.areaName).filter((a): a is string => !!a))].sort(),
    [concluded, remaining],
  );

  const matches = (c: TodayProgressEntry) =>
    (!query || normalize(c.name).includes(normalize(query))) && (!area || c.areaName === area);
  const shownConcluded = filter === "faltam" ? [] : concluded.filter(matches);
  const shownRemaining = filter === "concluidos" ? [] : remaining.filter(matches);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar colaborador..."
            className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
          />
        </div>
        {areas.length > 1 && (
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label="Filtrar por área"
            className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
        <div className="flex overflow-hidden rounded-md border border-border-strong">
          {(
            [
              ["todos", "Todos"],
              ["faltam", `Faltam (${remaining.length})`],
              ["concluidos", `Concluídos (${concluded.length})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium",
                filter === key ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shownConcluded.length + shownRemaining.length === 0 && (
        <p className="text-sm text-foreground-subtle">Ninguém encontrado com esse filtro.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filter !== "faltam" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-success">Já concluíram hoje ({shownConcluded.length})</p>
            {shownConcluded.length === 0 ? (
              <p className="text-xs text-foreground-subtle">Ninguém.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {shownConcluded.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span className="text-success">✓</span>
                    <Link href={`/indicadores/checklist/${c.id}`} className="hover:underline">{c.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {filter !== "concluidos" && (
          <div className={cn("flex flex-col gap-1.5", filter === "faltam" && "sm:col-span-2")}>
            <p className="text-xs font-semibold text-warning">Ainda falta ({shownRemaining.length})</p>
            {shownRemaining.length === 0 ? (
              <p className="text-xs text-foreground-subtle">Ninguém.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {shownRemaining.map((c) => {
                  const expanded = open === c.id;
                  return (
                    <li key={c.id} className="py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : c.id)}
                          className="flex min-w-0 items-center gap-1 text-left"
                          aria-expanded={expanded}
                        >
                          {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                          <span className="truncate">
                            {c.name}
                            {c.noAccess && <span className="text-xs text-foreground-subtle"> (sem acesso ao sistema)</span>}
                          </span>
                        </button>
                        <span className="shrink-0 text-xs text-foreground-subtle">{c.done}/{c.required}</span>
                      </div>
                      {expanded && (
                        <div className="mt-2 flex flex-col gap-2 pl-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/indicadores/checklist/${c.id}`} className="text-xs font-medium text-accent hover:underline">
                              Ver respostas do dia →
                            </Link>
                            {canJustify && c.missing.length > 0 && (
                              <JustifyChecklistItemDialog
                                collaboratorId={c.id}
                                collaboratorName={c.name}
                                dayKey={dayKey}
                                itemIds={c.missing.map((m) => m.id)}
                                itemLabel={c.missing.length === 1 ? c.missing[0].code : `${c.missing.length} equipamentos`}
                                triggerLabel={c.missing.length === 1 ? "Justificar e concluir" : `Justificar todos (${c.missing.length})`}
                              />
                            )}
                          </div>
                          <ul className="flex flex-col gap-1">
                            {c.missing.map((m) => (
                              <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-foreground">{m.code}</span>
                                {canJustify && c.missing.length > 1 && (
                                  <JustifyChecklistItemDialog
                                    collaboratorId={c.id}
                                    collaboratorName={c.name}
                                    dayKey={dayKey}
                                    itemIds={[m.id]}
                                    itemLabel={m.code}
                                  />
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
