"use client";

import { useRouter } from "next/navigation";

/** Escolhe um dia qualquer e recarrega a página com `?dia=yyyy-MM-dd`. */
export function DayJumpInput({ value, max }: { value: string; max?: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      value={value}
      max={max}
      aria-label="Ir para o dia"
      onChange={(e) => {
        if (e.target.value) router.push(`?dia=${e.target.value}`);
      }}
      className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
    />
  );
}
