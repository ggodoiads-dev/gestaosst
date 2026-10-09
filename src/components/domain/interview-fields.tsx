"use client";

import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle";

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {hint && <p className="text-xs text-foreground-subtle">{hint}</p>}
      {children}
    </div>
  );
}

export function YesNo({ value, onChange }: { value: "SIM" | "NAO" | ""; onChange: (v: "SIM" | "NAO") => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
      {(["SIM", "NAO"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "min-w-20 px-4 py-2 text-sm font-medium transition-colors",
            value === opt ? (opt === "SIM" ? "bg-success text-white" : "bg-neutral-soft text-foreground") : "bg-surface text-foreground-subtle hover:bg-surface-muted",
          )}
        >
          {opt === "SIM" ? "Sim" : "Não"}
        </button>
      ))}
    </div>
  );
}

export function SelectNative({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputClass, props.className)} />;
}
