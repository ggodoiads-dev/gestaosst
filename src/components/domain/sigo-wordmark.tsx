import { cn } from "@/lib/utils";

/**
 * Marca tipográfica do SIGO — pensada pra ficar sobre o fundo escuro da marca
 * (bg-brand), usada no login e na barra lateral. "O" final em cobre (brand-accent)
 * ecoa o destaque que a marca antiga usava, sem depender de nenhum arquivo de imagem.
 */
export function SigoWordmark({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const isLg = size === "lg";
  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "flex items-baseline font-bold leading-none tracking-tight text-white",
          isLg ? "text-4xl" : "text-xl",
        )}
      >
        <span>SIG</span>
        <span className="text-brand-accent">O</span>
      </div>
      <span
        className={cn(
          "uppercase text-white/50",
          isLg ? "mt-2 text-[11px] tracking-[0.16em]" : "mt-1 text-[8px] tracking-[0.12em]",
        )}
      >
        {isLg ? "Sistema Interno de Gestão Organizacional" : "Gestão Organizacional"}
      </span>
    </div>
  );
}
