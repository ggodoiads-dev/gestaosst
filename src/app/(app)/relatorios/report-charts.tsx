import type { ReportSeries } from "@/domain/reports/types";

/** Colunas simples (SVG, renderizado no servidor): o último ponto é o mês do relatório e fica em destaque. */
export function SeriesBars({ series }: { series: ReportSeries }) {
  const W = 480;
  const H = 130;
  const top = 18;
  const bottom = 20;
  const values = series.points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const plotH = H - top - bottom;
  const groupW = W / Math.max(series.points.length, 1);
  const barW = Math.min(36, groupW - 10);
  const fmt = (v: number) => (series.unit === "%" ? `${v}%` : v.toLocaleString("pt-BR"));
  return (
    <figure className="break-inside-avoid">
      <figcaption className="mb-1 text-xs font-medium text-foreground-muted">{series.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-xl" role="img" aria-label={series.title}>
        <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--border-strong)" />
        {series.points.map((p, i) => {
          const h = Math.max((p.value / max) * plotH, p.value > 0 ? 2 : 0);
          const x = i * groupW + (groupW - barW) / 2;
          const last = i === series.points.length - 1;
          return (
            <g key={p.label}>
              <rect x={x} y={H - bottom - h} width={barW} height={h} rx={2} fill={last && series.highlightLast ? "var(--accent)" : "var(--border-strong)"} />
              <text x={x + barW / 2} y={H - bottom - h - 4} textAnchor="middle" fontSize={10} fontWeight={last ? 700 : 400} fill="var(--foreground-muted)">
                {fmt(p.value)}
              </text>
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--foreground-subtle)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
