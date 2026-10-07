const TONES = {
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
  neutral: "stroke-border-strong",
} as const;

export function toneForPercent(percent: number | null): keyof typeof TONES {
  if (percent === null) return "neutral";
  return percent >= 90 ? "success" : percent >= 70 ? "warning" : "danger";
}

/** Anel de progresso (SVG) com o percentual no centro — `null` mostra "—" (sem dado no mês). */
export function ProgressRing({ percent, size = 112, label }: { percent: number | null; size?: number; label?: string }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? "Aderência"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-neutral-soft" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={`${TONES[toneForPercent(percent)]} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-foreground">{percent === null ? "—" : `${percent}%`}</span>
      </div>
    </div>
  );
}
