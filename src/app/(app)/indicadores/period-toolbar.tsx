"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "dia" | "mes" | "ano";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function shift(period: Period, refKey: string, delta: number): string {
  const [y, m, d] = refKey.split("-").map(Number);
  if (period === "dia") {
    const dt = new Date(y, m - 1, d + delta);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }
  if (period === "mes") {
    const dt = new Date(y, m - 1 + delta, 1);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-01`;
  }
  return `${y + delta}-01-01`;
}

/** Filtro de período (Dia / Mês / Ano) do card de aderência: guarda a escolha na URL (?cp=...&cr=...). */
export function PeriodToolbar({ period, refKey, todayKey }: { period: Period; refKey: string; todayKey: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(nextPeriod: Period, nextRef: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("cp", nextPeriod);
    sp.set("cr", nextRef > todayKey ? todayKey : nextRef);
    router.push(`/indicadores?${sp.toString()}#checklist-por-colaborador`, { scroll: false });
  }

  const [y, m] = refKey.split("-");
  const nextKey = shift(period, refKey, 1);
  const cut = period === "dia" ? 10 : period === "mes" ? 7 : 4;
  const atEnd = nextKey.slice(0, cut) > todayKey.slice(0, cut);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-border-strong">
        {(["dia", "mes", "ano"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p, refKey)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium",
              period === p ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
            )}
          >
            {p === "mes" ? "Mês" : p === "ano" ? "Ano" : "Dia"}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Anterior"
        onClick={() => go(period, shift(period, refKey, -1))}
        className="grid size-9 place-items-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted"
      >
        <ChevronLeft className="size-4" />
      </button>
      {period === "dia" && (
        <input
          type="date"
          value={refKey}
          max={todayKey}
          aria-label="Escolher o dia"
          onChange={(e) => e.target.value && go("dia", e.target.value)}
          className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
        />
      )}
      {period === "mes" && (
        <input
          type="month"
          value={`${y}-${m}`}
          max={todayKey.slice(0, 7)}
          aria-label="Escolher o mês"
          onChange={(e) => e.target.value && go("mes", `${e.target.value}-01`)}
          className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
        />
      )}
      {period === "ano" && (
        <select
          value={y}
          aria-label="Escolher o ano"
          onChange={(e) => go("ano", `${e.target.value}-01-01`)}
          className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
        >
          {Array.from({ length: Number(todayKey.slice(0, 4)) - 2024 + 1 }, (_, i) => Number(todayKey.slice(0, 4)) - i).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        aria-label="Próximo"
        disabled={atEnd}
        onClick={() => go(period, shift(period, refKey, 1))}
        className="grid size-9 place-items-center rounded-md border border-border-strong bg-surface hover:bg-surface-muted disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => go("dia", todayKey)}
        className="h-9 rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-foreground-subtle hover:bg-surface-muted"
      >
        Hoje
      </button>
    </div>
  );
}
