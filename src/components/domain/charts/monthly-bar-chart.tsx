"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export type MonthlyDatum = {
  label: string;
  count: number;
};

/** Barras verticais por mês — usado no dashboard de acidentes/incidentes do ano. */
export function MonthlyBarChart({ data, color = "var(--accent)" }: { data: MonthlyDatum[]; color?: string }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.count > 0 ? color : "var(--surface-muted)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
