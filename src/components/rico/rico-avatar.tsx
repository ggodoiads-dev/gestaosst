"use client";

import { cn } from "@/lib/utils";

export function RicoAvatar({
  state = "idle",
  className,
}: {
  state?: "idle" | "talking" | "listening";
  className?: string;
}) {
  const eyeRadius = state === "listening" ? 4.5 : 4;
  const pupilRadius = state === "listening" ? 2.3 : 2;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn(
        "size-full",
        state === "idle" && "animate-rico-breathe",
        className,
      )}
      role="img"
      aria-label="Rico"
    >
      <circle cx="32" cy="32" r="30" className="fill-brand-accent" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />

      <g transform="translate(22.5,29)">
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 0.1;1 1"
            keyTimes="0;0.93;0.96;1"
            dur="4.8s"
            repeatCount="indefinite"
          />
          <circle r={eyeRadius} fill="white" />
          <circle r={pupilRadius} className="fill-brand" />
        </g>
      </g>
      <g transform="translate(41.5,29)">
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1;1 1;1 0.1;1 1"
            keyTimes="0;0.93;0.96;1"
            dur="4.8s"
            repeatCount="indefinite"
          />
          <circle r={eyeRadius} fill="white" />
          <circle r={pupilRadius} className="fill-brand" />
        </g>
      </g>

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

      {state === "listening" && (
        <circle cx="32" cy="32" r="30" fill="none" stroke="#f43f5e" strokeWidth="2.5" opacity="0.75">
          <animate attributeName="r" values="27;32;27" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.75;0.1;0.75" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}
