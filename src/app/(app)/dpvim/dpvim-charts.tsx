"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DayBar = { label: string; arrived: number; concluded: number };

/** Chegadas e conclusões de DPVIM por dia: dá para ver se o pátio está acumulando carga. */
export function ArrivalsChart({ data }: { data: DayBar[] }) {
  if (data.length === 0) return <p className="text-xs text-foreground-subtle">Sem DPVIM no período.</p>;
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }} />
          <Tooltip cursor={{ fill: "var(--surface-muted)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="arrived" name="Chegaram" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="concluded" name="Concluídas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
