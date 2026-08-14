"use client";

import { cn } from "@/lib/utils";

export function RicoAvatar({
  state = "idle",
  className,
}: {
  state?: "idle" | "talking";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-full", className)}
      role="img"
      aria-label="Rico"
    >
      <circle cx="32" cy="32" r="30" className="fill-brand-accent" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />

      <circle cx="22.5" cy="29" r="4" fill="white" />
      <circle cx="41.5" cy="29" r="4" fill="white" />
      <circle cx="22.5" cy="29" r="2" className="fill-brand" />
      <circle cx="41.5" cy="29" r="2" className="fill-brand" />

      {state === "talking" ? (
        <ellipse cx="32" cy="42" rx="6" ry="4" className="fill-brand" />
      ) : (
        <path
          d="M23 40 Q32 47 41 40"
          fill="none"
          className="stroke-brand"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {state === "talking" && (
        <circle cx="32" cy="32" r="30" fill="none" stroke="white" strokeWidth="2" opacity="0.6">
          <animate attributeName="r" values="26;31;26" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
