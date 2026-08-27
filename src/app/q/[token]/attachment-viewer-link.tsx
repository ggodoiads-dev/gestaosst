import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/** Link direto (mesma aba) pro documento — testamos um overlay com iframe antes, mas o Office
 * Online Viewer e o PDF cortavam o conteúdo dentro do iframe (só dava pra ver o documento inteiro
 * abrindo em outra aba). Sem `target="_blank"` a navegação fica na mesma aba, então o botão
 * "voltar" nativo do navegador funciona normalmente pra retornar à ficha pública — diferente de
 * abrir em nova aba, que em navegador de QR Code (câmera, WhatsApp) às vezes não tem como fechar. */
export function AttachmentViewerLink({
  href,
  label,
  size = "sm",
}: {
  href: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong bg-surface-muted font-medium text-accent transition-colors hover:bg-accent-soft",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
      )}
    >
      <FileText className={size === "sm" ? "size-3" : "size-3.5"} />
      {label}
    </a>
  );
}
