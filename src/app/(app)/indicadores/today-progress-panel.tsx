"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName, initials } from "@/lib/format-name";
import { JustifyChecklistItemDialog } from "@/components/domain/justify-checklist-item-dialog";
import { UndoChecklistJustificationsButton } from "@/components/domain/undo-checklist-justifications-button";
import type { TodayProgressEntry } from "@/server/services/checklist-compliance.service";

type Filter = "todos" | "faltam" | "concluidos";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function TodayProgressPanel({
  concluded,
  remaining,
  dayKey,
  canJustify,
  when = "hoje",
  off = [],
}: {
  concluded: TodayProgressEntry[];
  remaining: TodayProgressEntry[];
  dayKey: string;
  canJustify: boolean;
  when?: string;
  off?: { id: string; name: string; areaName: string | null; reason: string; kind: "FALTA" | "AUSENCIA" }[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [area, setArea] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const total = concluded.length + remaining.length;
  const isClosedDay = when !== "hoje";
  const faltas = off.filter((o) => o.kind === "FALTA");
  const ausencias = off.filter((o) => o.kind !== "FALTA");
  const noAccessCount = remaining.filter((c) => c.noAccess).length;
  const areas = useMemo(
    () => [...new Set([...concluded, ...remaining].map((c) => c.areaName).filter((a): a is string => !!a))].sort(),
    [concluded, remaining],
  );

  const matches = (c: TodayProgressEntry) =>
    (!query || normalize(c.name).includes(normalize(query))) && (!area || c.areaName === area);
  const shownRemaining = filter === "concluidos" ? [] : remaining.filter(matches);
  const shownConcluded = filter === "faltam" ? [] : concluded.filter(matches);

  const tiles: { key: Filter; label: string; value: number; tone: string; ring: string }[] = [
    { key: "todos", label: "Cobrados", value: total, tone: "text-foreground", ring: "border-accent" },
    { key: "concluidos", label: `Concluíram ${when}`, value: concluded.length, tone: "text-success", ring: "border-success" },
    { key: "faltam", label: "Ainda faltam", value: remaining.length, tone: "text-warning", ring: "border-warning" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(filter === t.key ? "todos" : t.key)}
            aria-pressed={filter === t.key}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-lg border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
              filter === t.key ? cn("border-2", t.ring) : "border-border",
            )}
          >
            <span className={cn("text-2xl font-semibold tabular-nums leading-none", t.tone)}>{t.value}</span>
            <span className="text-xs text-foreground-subtle">{t.label}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-foreground-subtle">
        &quot;Cobrados&quot; = quem está <strong>escalado para trabalhar neste dia</strong>
        {off.length > 0 && (
          <>
            . Mais <strong>{ausencias.length}</strong> de folga, férias ou atestado (sem medida)
            {faltas.length > 0 && (
              <>
                {" "}e <strong>{faltas.length}</strong> com falta lançada (a falta tem a sua própria escada de advertência)
              </>
            )}
          </>
        )}
        .
      </p>

      {total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-soft">
            <div className="h-full rounded-full bg-success" style={{ width: `${Math.round((concluded.length / total) * 100)}%` }} />
          </div>
          <p className="text-xs text-foreground-subtle">
            {concluded.length} de {total} já concluíram
            {noAccessCount > 0 && ` · ${noAccessCount} sem acesso ao sistema`}
          </p>
        </div>
      )}

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
      </div>

      {shownConcluded.length + shownRemaining.length === 0 && (
        <p className="text-sm text-foreground-subtle">Ninguém encontrado com esse filtro.</p>
      )}

      {shownRemaining.length > 0 && (
        <section className="flex flex-col gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Estavam presentes e não concluíram ({shownRemaining.length})</h3>
            <p className="text-[11px] text-foreground-subtle">
              Gera advertência de checklist quem fez menos de 80% dos equipamentos no dia. 80% ou mais = cumpriu, sem medida.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {shownRemaining.map((c) => {
              const expanded = open === c.id;
              const pct = c.required === 0 ? 0 : Math.round((c.done / c.required) * 100);
              return (
                <div
                  key={c.id}
                  className={cn("overflow-hidden rounded-lg border bg-surface", expanded ? "border-border-strong lg:col-span-2" : "border-border")}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : c.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-xs font-semibold text-warning">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate text-sm font-medium text-foreground">{formatPersonName(c.name)}</span>
                        {c.noAccess && (
                          <span className="rounded bg-neutral-soft px-1.5 py-0.5 text-[11px] font-medium text-foreground-muted">
                            sem acesso
                          </span>
                        )}
                        {c.justified > 0 && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">{c.justified} justificado(s)</span>}
                        {isClosedDay && !c.noAccess && (
                          c.done * 100 < c.required * 80 ? (
                            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger">gera advertência</span>
                          ) : (
                            <span className="rounded bg-neutral-soft px-1.5 py-0.5 text-[11px] font-medium text-foreground-muted">80% ou mais · sem medida</span>
                          )
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-neutral-soft">
                          <span className={cn("block h-full rounded-full", pct === 0 ? "bg-danger" : "bg-warning")} style={{ width: `${Math.max(pct, 2)}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-foreground-subtle">
                          {c.done}/{c.required}
                          {c.areaName && ` · ${c.areaName}`}
                        </span>
                      </span>
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-foreground-subtle transition-transform", expanded && "rotate-180")} />
                  </button>

                  {expanded && (
                    <div className="flex flex-col gap-3 border-t border-border bg-surface-muted px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/indicadores/checklist/${c.id}?dia=${dayKey}`}
                          className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground hover:bg-neutral-soft"
                        >
                          Ver respostas do dia
                        </Link>
                        {canJustify && c.justified > 0 && (
                          <UndoChecklistJustificationsButton
                            collaboratorId={c.id}
                            collaboratorName={formatPersonName(c.name)}
                            dayKey={dayKey}
                            count={c.justified}
                            label={`Desfazer justificativas (${c.justified})`}
                          />
                        )}
                        {canJustify && c.missing.length > 0 && (
                          <JustifyChecklistItemDialog
                            collaboratorId={c.id}
                            collaboratorName={formatPersonName(c.name)}
                            dayKey={dayKey}
                            itemIds={c.missing.map((m) => m.id)}
                            itemLabel={c.missing.length === 1 ? c.missing[0].code : `${c.missing.length} equipamentos`}
                            triggerLabel={c.missing.length === 1 ? "Justificar e concluir" : `Justificar todos (${c.missing.length})`}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-foreground-subtle">Faltam {c.missing.length} equipamento(s):</p>
                        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
                          {c.missing.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-surface px-2.5 py-1.5 text-xs">
                              <span className="font-mono text-foreground">{m.code}</span>
                              {canJustify && c.missing.length > 1 && (
                                <JustifyChecklistItemDialog
                                  collaboratorId={c.id}
                                  collaboratorName={formatPersonName(c.name)}
                                  dayKey={dayKey}
                                  itemIds={[m.id]}
                                  itemLabel={m.code}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {shownConcluded.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-success">Concluíram ({shownConcluded.length})</h3>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {shownConcluded.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface pr-2 hover:bg-surface-muted">
                <Link href={`/indicadores/checklist/${c.id}?dia=${dayKey}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <Check className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{formatPersonName(c.name)}</span>
                    <span className="block text-xs text-foreground-subtle">
                      {c.required}/{c.required} equipamentos
                      {c.areaName && ` · ${c.areaName}`}
                      {c.justified > 0 && <span className="font-medium text-warning"> · {c.justified} justificado(s)</span>}
                    </span>
                  </span>
                </Link>
                {canJustify && c.justified > 0 && (
                  <UndoChecklistJustificationsButton
                    collaboratorId={c.id}
                    collaboratorName={formatPersonName(c.name)}
                    dayKey={dayKey}
                    count={c.justified}
                    label="Desfazer justificativas"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {faltas.length > 0 && (
        <details className="rounded-lg border border-danger/30 bg-surface px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-danger">
            Falta lançada {when === "hoje" ? "hoje" : "neste dia"} — advertência por falta ({faltas.length})
          </summary>
          <OffList entries={faltas} dayKey={dayKey} />
        </details>
      )}

      {ausencias.length > 0 && (
        <details className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
            Folga, férias ou atestado {when === "hoje" ? "hoje" : "neste dia"} — não cobrados, sem medida ({ausencias.length})
          </summary>
          <OffList entries={ausencias} dayKey={dayKey} />
        </details>
      )}
    </div>
  );
}

function OffList({ entries, dayKey }: { entries: { id: string; name: string; areaName: string | null; reason: string }[]; dayKey: string }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      {entries.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-2">
          <Link href={`/indicadores/checklist/${o.id}?dia=${dayKey}`} className="min-w-0 truncate hover:underline">
            {formatPersonName(o.name)}
            {o.areaName && <span className="text-foreground-subtle"> · {o.areaName}</span>}
          </Link>
          <span className="shrink-0 text-foreground-subtle">{o.reason}</span>
        </li>
      ))}
    </ul>
  );
}
