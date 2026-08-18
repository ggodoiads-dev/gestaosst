"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PublicPhoto({
  src,
  alt,
  className,
  rounded = "full",
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: "full" | "lg";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ampliar foto de ${alt}`}
        className={cn(
          "shrink-0 cursor-zoom-in overflow-hidden border border-border transition-opacity hover:opacity-80",
          rounded === "full" ? "rounded-full" : "rounded-lg",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI embutida, não é asset otimizável */}
        <img src={src} alt={alt} className="size-full object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI embutida, não é asset otimizável */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
