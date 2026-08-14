import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  accent: "text-accent",
} as const;

export function StatCard({
  label,
  value,
  href,
  tone = "neutral",
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: keyof typeof TONE_CLASSES;
  hint?: string;
  icon?: ReactNode;
}) {
  const content = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4",
        href && "transition-colors hover:border-border-strong",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-subtle">{label}</span>
        {icon && <span className={cn("size-4", TONE_CLASSES[tone])}>{icon}</span>}
      </div>
      <span className={cn("text-2xl font-semibold tabular-nums", TONE_CLASSES[tone])}>{value}</span>
      {hint && <span className="text-xs text-foreground-subtle">{hint}</span>}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
      {content}
    </Link>
  );
}
