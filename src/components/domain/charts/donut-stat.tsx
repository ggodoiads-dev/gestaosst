"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type DonutSegment = {
  label: string;
  value: number;
  color: string; // valor CSS (ex: "var(--success)")
};

/** Donut com o percentual no centro — usado pra taxas de cumprimento/conformidade/aderência. */
export function DonutStat({
  segments,
  centerLabel,
  centerValue,
  size = 140,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const data = total === 0 ? [{ label: "Sem dados", value: 1, color: "var(--border)" }] : segments;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={size * 0.32}
              outerRadius={size * 0.48}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-foreground">{centerValue}</span>
          <span className="text-[10px] text-foreground-subtle">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-foreground-subtle">{s.label}</span>
            <span className="font-medium tabular-nums text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
