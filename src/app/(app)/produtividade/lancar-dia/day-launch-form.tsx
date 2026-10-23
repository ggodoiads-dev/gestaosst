"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { savePeopleEntriesAction } from "@/server/actions/production.actions";

type Helper = { id: string; name: string; areaId: string | null; areaName: string | null };
type ActivityRef = { id: string; name: string; measuresQuantity: boolean; areaIds: string[] };

export function DayLaunchForm({ helpers, activities, today }: { helpers: Helper[]; activities: ActivityRef[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState(today);
  const [activityId, setActivityId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const activity = activities.find((a) => a.id === activityId) ?? null;
  const restricted = !!activity && activity.areaIds.length > 0 && !showAll;
  const people = useMemo(
    () => (restricted ? helpers.filter((h) => h.areaId && activity!.areaIds.includes(h.areaId)) : helpers),
    [helpers, restricted, activity],
  );

  function pickActivity(id: string) {
    setActivityId(id);
    setValues({});
    setChecked(new Set());
  }

  const chosen = people.filter((p) => (activity?.measuresQuantity ? (values[p.id] ?? "").trim() !== "" : checked.has(p.id)));

  function save() {
    if (!activity || chosen.length === 0) return;
    start(async () => {
      const res = await savePeopleEntriesAction({
        day,
        entries: chosen.map((p) => ({
          collaboratorId: p.id,
          activityId: activity.id,
          quantity: activity.measuresQuantity ? Number(values[p.id]) : null,
          notes: "Lançado em grupo (lançar o dia da equipe).",
        })),
      });
      if (res.ok) {
        toast.success(`${res.created + res.updated} lançamento(s) gravados${res.skipped > 0 ? `, ${res.skipped} não puderam ser lançados` : ""}.`);
        router.push("/produtividade");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Dia
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Atividade
          <select value={activityId} onChange={(e) => pickActivity(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            <option value="">Escolher…</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      </section>

      {activity && (
        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{activity.measuresQuantity ? "Quanto cada pessoa fez" : "Quem fez"}</h3>
              <p className="text-[11px] text-foreground-subtle">
                {activity.measuresQuantity ? "Preencha só quem produziu; quem ficar em branco não recebe lançamento." : "Esta atividade não se mede por quantidade: marque quem fez."}
                {activity.areaIds.length > 0 && !showAll && " Mostrando as pessoas da área desta atividade."}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {activity.areaIds.length > 0 && (
                <label className="flex items-center gap-1.5 text-foreground-muted">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                  Mostrar todos
                </label>
              )}
              {!activity.measuresQuantity && (
                <button type="button" onClick={() => setChecked(new Set(people.map((p) => p.id)))} className="font-medium text-accent hover:underline">
                  Marcar todos
                </button>
              )}
            </div>
          </div>
          {people.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-subtle">Ninguém da área desta atividade. Marque &quot;Mostrar todos&quot; para escolher qualquer ajudante.</p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0">
                  <span className="min-w-0 text-sm text-foreground">
                    {p.name}
                    {p.areaName && <span className="ml-2 text-[11px] text-foreground-subtle">{p.areaName}</span>}
                  </span>
                  {activity.measuresQuantity ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={values[p.id] ?? ""}
                      onChange={(e) => setValues((cur) => ({ ...cur, [p.id]: e.target.value.replace(/\D/g, "") }))}
                      className="h-8 w-28 rounded-md border border-border-strong bg-surface px-2 text-right text-sm tabular-nums text-foreground"
                      placeholder="—"
                      aria-label={`Quantidade de ${p.name}`}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={checked.has(p.id)}
                      onChange={(e) =>
                        setChecked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                      className="size-4 accent-[var(--accent)]"
                      aria-label={`${p.name} fez`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={save} loading={pending} disabled={!activity || chosen.length === 0}>
          {chosen.length > 0 ? `Lançar para ${chosen.length} pessoa(s)` : "Lançar"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/produtividade")}>
          Cancelar
        </Button>
      </div>
      <p className="text-[11px] text-foreground-subtle">Se a pessoa já tem essa atividade neste dia, o lançamento dela é atualizado, não duplicado.</p>
    </div>
  );
}
