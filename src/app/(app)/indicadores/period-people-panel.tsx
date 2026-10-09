"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPersonName } from "@/lib/format-name";
import type { PeriodPerson } from "@/server/services/checklist-compliance.service";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function PeriodPeoplePanel({ people, refKey }: { people: PeriodPerson[]; refKey: string }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const areas = useMemo(() => [...new Set(people.map((p) => p.areaName).filter((a): a is string => !!a))].sort(), [people]);
  const rows = people
    .filter(
      (p) =>
        (!query || normalize(p.name).includes(normalize(query))) &&
        (!area || p.areaName === area) &&
        (!onlyPending || p.shiftsComplete < p.shiftsRequired),
    )
    .sort((a, b) => a.shiftsComplete / a.shiftsRequired - b.shiftsComplete / b.shiftsRequired || a.name.localeCompare(b.name, "pt-BR"));

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
        <label className="flex items-center gap-1.5 text-xs text-foreground-subtle">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Só com pendência
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-foreground-subtle">Ninguém encontrado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {rows.map((p) => {
            const pct = Math.round((p.shiftsComplete / p.shiftsRequired) * 100);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link
                  href={`/indicadores?collaboratorId=${p.id}&period=mes&ref=${refKey}#checklist-por-colaborador`}
                  className="min-w-0 truncate hover:underline"
                >
                  {formatPersonName(p.name)}
                  {p.areaName && <span className="text-xs text-foreground-subtle"> · {p.areaName}</span>}
                  {p.noAccess && <span className="text-xs text-foreground-subtle"> (sem acesso ao sistema)</span>}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-foreground-subtle">
                  {p.shiftsComplete}/{p.shiftsRequired} turnos
                  <span className={cn("w-10 text-right font-semibold", pct === 100 ? "text-success" : pct >= 70 ? "text-warning" : "text-danger")}>
                    {pct}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
