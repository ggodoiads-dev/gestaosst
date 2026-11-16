"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { creditHolidayWorkAction } from "@/server/actions/bank-hours.actions";

type Person = { collaboratorId: string; name: string; turnoName: string | null; usesTimeClock: boolean; punched: boolean };
type Suggestion = { holiday: { date: string; name: string }; people: Person[] };

const br = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** Quem estava escalado para trabalhar num feriado e ainda não ganhou o dia de folga. Já vem marcado quem bateu ponto; o resto o gestor confere e marca. */
export function HolidayCreditPanel({ suggestions, disabled }: { suggestions: Suggestion[]; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(suggestions.map((s) => [s.holiday.date, new Set(s.people.filter((p) => p.punched).map((p) => p.collaboratorId))])),
  );

  function toggle(date: string, id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev[date] ?? []);
      if (on) next.add(id);
      else next.delete(id);
      return { ...prev, [date]: next };
    });
  }
  function setAll(date: string, ids: string[]) {
    setSelected((prev) => ({ ...prev, [date]: new Set(ids) }));
  }

  function credit(date: string) {
    const ids = [...(selected[date] ?? [])];
    if (ids.length === 0) return;
    start(async () => {
      const res = await creditHolidayWorkAction(date, ids);
      if (res.ok) {
        toast.success(`${res.created} dia(s) de folga creditado(s).`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card className="border-warning/50">
      <CardHeader>
        <CardTitle>Feriados trabalhados a creditar</CardTitle>
        <CardDescription>
          Pessoas escaladas para trabalhar no feriado que ainda não ganharam o dia de folga. Já vem marcado quem bateu ponto no dia. Quem é de turno que não bate ponto ou ainda
          não teve o ponto importado você confere e marca. Quem não trabalhou de fato (ex.: o turno ADM folgou no feriado) deixe desmarcado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {suggestions.map((s) => {
          const sel = selected[s.holiday.date] ?? new Set<string>();
          return (
            <div key={s.holiday.date} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {br(s.holiday.date)} — {s.holiday.name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAll(s.holiday.date, s.people.map((p) => p.collaboratorId))}>
                    Marcar todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAll(s.holiday.date, [])}>
                    Limpar
                  </Button>
                  <Button size="sm" onClick={() => credit(s.holiday.date)} loading={pending} disabled={disabled || sel.size === 0}>
                    Creditar 1 dia a {sel.size} pessoa(s)
                  </Button>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {s.people.map((p) => (
                  <li key={p.collaboratorId}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-muted">
                      <Checkbox checked={sel.has(p.collaboratorId)} onCheckedChange={(v) => toggle(s.holiday.date, p.collaboratorId, v === true)} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{p.name}</span>
                      {p.turnoName && <span className="text-[11px] text-foreground-subtle">T{p.turnoName}</span>}
                      {p.punched ? (
                        <Badge tone="success">bateu ponto</Badge>
                      ) : p.usesTimeClock ? (
                        <Badge tone="warning">sem batida</Badge>
                      ) : (
                        <Badge tone="neutral">não bate ponto</Badge>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
