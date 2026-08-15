"use client";

import { useEffect, useState } from "react";

export function ChecklistRing({
  value,
  label,
  sublabel,
  size = 96,
  strokeWidth = 8,
}: {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(circumference - (clamped / 100) * circumference));
    return () => cancelAnimationFrame(id);
  }, [circumference, clamped]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="white" strokeOpacity="0.15" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--brand-accent)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-white">{Math.round(clamped)}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-white/70">{label}</span>
      {sublabel && <span className="text-[11px] text-white/45">{sublabel}</span>}
    </div>
  );
}
