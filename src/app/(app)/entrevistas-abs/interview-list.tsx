"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatPersonName, initials } from "@/lib/format-name";
import { CLASSIFICATION_LABELS, type Classification } from "@/domain/absence-interview/form";

type Status = "SOLICITADA" | "RESPONDIDA" | "CONCLUIDA";
type Item = {
  id: string;
  name: string;
  area: string | null;
  kind: string;
  dateLabel: string;
  status: Status;
  classification: string | null;
};

const STATUS: Record<Status, { label: string; tone: "warning" | "info" | "success" }> = {
  SOLICITADA: { label: "Aguardando colaborador", tone: "warning" },
  RESPONDIDA: { label: "Aguardando avaliação", tone: "info" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function InterviewList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "TODAS">("TODAS");

  const count = (s: Status) => items.filter((i) => i.status === s).length;
  const shown = useMemo(
    () => items.filter((i) => (filter === "TODAS" || i.status === filter) && (!query || normalize(i.name).includes(normalize(query)))),
    [items, filter, query],
  );

  const tiles: { key: Status | "TODAS"; label: string; value: number; tone: string; ring: string }[] = [
    { key: "TODAS", label: "Todas", value: items.length, tone: "text-foreground", ring: "border-accent" },
    { key: "SOLICITADA", label: "Aguardando colaborador", value: count("SOLICITADA"), tone: "text-warning", ring: "border-warning" },
    { key: "RESPONDIDA", label: "Aguardando avaliação", value: count("RESPONDIDA"), tone: "text-accent", ring: "border-accent" },
    { key: "CONCLUIDA", label: "Concluídas", value: count("CONCLUIDA"), tone: "text-success", ring: "border-success" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(filter === t.key ? "TODAS" : t.key)}
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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar colaborador..."
          className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          {items.length === 0 ? "Nenhuma entrevista pedida ainda." : "Nenhuma entrevista com esse filtro."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {shown.map((i) => (
            <Link
              key={i.id}
              href={`/entrevistas-abs/${i.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 hover:bg-surface-muted"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {initials(i.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{formatPersonName(i.name)}</span>
                <span className="block text-xs text-foreground-subtle">
                  {i.kind} em {i.dateLabel}
                  {i.area && ` · ${i.area}`}
                  {i.classification && ` · ${CLASSIFICATION_LABELS[i.classification as Classification]}`}
                </span>
              </span>
              <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
