"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from "recharts";

export type AdherenceBar = { label: string; pct: number; complete: number; required: number };

function colorFor(pct: number): string {
  return pct >= 90 ? "var(--success)" : pct >= 70 ? "var(--warning)" : "var(--danger)";
}

/** Aderência de checklist do período em barras: uma por dia (ou por mês, quando o período é um ano), colorida pela faixa (90%+ verde, 70%+ amarelo). */
export function PeriodAdherenceChart({ bars }: { bars: AdherenceBar[] }) {
  if (bars.length === 0) return <p className="text-xs text-foreground-subtle">Sem turnos cobrados nesse período.</p>;
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 90, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }} />
          <ReferenceLine y={90} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(value, _name, item) => {
              const p = item.payload as AdherenceBar;
              return [`${value}% — ${p.complete} de ${p.required} turnos cumpridos`, "Aderência"];
            }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {bars.map((b, i) => (
              <Cell key={i} fill={colorFor(b.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
