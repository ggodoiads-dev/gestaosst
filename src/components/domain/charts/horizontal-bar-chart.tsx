"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export type BarDatum = {
  name: string;
  value: number;
  color?: string;
};

/** Ranking em barras horizontais — top equipamentos com problemas, tipos de falha, desempenho por área. */
export function HorizontalBarChart({ data, height, color = "var(--accent)" }: { data: BarDatum[]; height?: number; color?: string }) {
  if (data.length === 0) {
    return <p className="px-4 py-6 text-sm text-foreground-subtle">Sem dados suficientes ainda.</p>;
  }

  return (
    <div style={{ width: "100%", height: height ?? Math.max(120, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground-subtle)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
