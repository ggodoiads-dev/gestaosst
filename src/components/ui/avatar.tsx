import * as React from "react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-7 text-[11px]",
    md: "size-8 text-xs",
    lg: "size-10 text-sm",
  } as const;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-accent-soft text-accent font-semibold shrink-0",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
