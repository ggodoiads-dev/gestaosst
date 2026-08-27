"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Abre o documento num overlay dentro da própria página, em vez de navegar pra outra aba/URL —
 * em navegador de QR Code (câmera, WhatsApp, apps de scanner) o "voltar" do navegador nem sempre
 * existe ou some depois que o visualizador do Office/PDF assume a página. Fechando o overlay
 * (botão X) volta pra ficha pública sem depender de histórico de navegação nenhum. */
export function AttachmentViewerLink({
  href,
  label,
  size = "sm",
}: {
  href: string;
  label: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong bg-surface-muted font-medium text-accent transition-colors hover:bg-accent-soft",
          size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
        )}
      >
        <FileText className={size === "sm" ? "size-3" : "size-3.5"} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/85">
          <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5 shadow">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            <div className="flex shrink-0 items-center gap-3">
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                Abrir em nova aba
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-foreground-subtle hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <iframe src={href} title={label} className="h-full w-full flex-1 border-0 bg-white" />
        </div>
      )}
    </>
  );
}
