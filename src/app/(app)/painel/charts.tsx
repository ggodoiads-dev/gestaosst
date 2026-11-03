/** Gráficos em SVG, renderizados no servidor (sem biblioteca): linha com meta, mini-linha de tendência e rosca de percentual. */

export function LineChart({ title, points, goal, unit = "%", height = 190 }: { title: string; points: { label: string; value: number | null }[]; goal?: number | null; unit?: string; height?: number }) {
  const W = 560;
  const padL = 36;
  const padR = 14;
  const top = 18;
  const bottom = 24;
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return <p className="text-sm text-foreground-subtle">Sem dados para o gráfico.</p>;
  const all = goal != null ? [...vals, goal] : vals;
  const lo = Math.floor(Math.min(...all) * 0.9);
  const hi = Math.ceil(Math.max(...all) * 1.08);
  const y = (v: number) => top + (1 - (v - lo) / Math.max(hi - lo, 1)) * (height - top - bottom);
  const step = (W - padL - padR) / Math.max(points.length - 1, 1);
  const x = (i: number) => padL + i * step;
  const segments: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segments.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `;
  });
  if (cur) segments.push(cur);
  const last = [...points].reverse().findIndex((p) => p.value !== null);
  const lastIdx = last === -1 ? -1 : points.length - 1 - last;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium text-foreground-muted">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--foreground-subtle)">
              {t}
              {unit}
            </text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="var(--warning)" strokeWidth={1.6} strokeDasharray="6 5" />
            <text x={W - padR} y={y(goal) - 5} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--warning)">
              meta {String(goal).replace(".", ",")}
              {unit}
            </text>
          </g>
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--foreground)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          <text key={p.label + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--foreground-subtle)">
            {p.label}
          </text>
        ))}
        {lastIdx >= 0 && points[lastIdx].value !== null && (
          <g>
            <circle cx={x(lastIdx)} cy={y(points[lastIdx].value as number)} r={5} fill="var(--accent)" />
            <text x={x(lastIdx)} y={y(points[lastIdx].value as number) - 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">
              {String(points[lastIdx].value).replace(".", ",")}
              {unit}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

export function Sparkline({ values, tone = "neutral" }: { values: number[]; tone?: "good" | "bad" | "warn" | "neutral" }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 36;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 1e-9);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 4) + 2, H - 4 - ((v - lo) / span) * (H - 8)] as const);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const color = tone === "good" ? "var(--success)" : tone === "bad" ? "var(--danger)" : tone === "warn" ? "var(--warning)" : "var(--foreground-muted)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <path d={`${d} L${W - 2} ${H} L2 ${H} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
    </svg>
  );
}

export function Ring({ percent, size = 92, tone = "neutral" }: { percent: number; size?: number; tone?: "good" | "bad" | "warn" | "neutral" }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(Math.max(percent, 0), 100);
  const color = tone === "good" ? "var(--success)" : tone === "bad" ? "var(--danger)" : tone === "warn" ? "var(--warning)" : "var(--accent)";
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${percent}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.24} fontWeight={700} fill="var(--foreground)">
        {Math.round(p)}%
      </text>
    </svg>
  );
}
