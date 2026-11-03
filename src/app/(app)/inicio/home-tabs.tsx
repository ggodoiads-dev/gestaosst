import Link from "next/link";
import { cn } from "@/lib/utils";

/** Abas do visual novo: Início (a experiência) e Painel (os números). */
export function HomeTabs({ active, floating = false }: { active: "inicio" | "painel"; floating?: boolean }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={cn(
        "rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
        on ? (floating ? "bg-white text-[#001840]" : "bg-brand text-white") : floating ? "text-white/75 hover:text-white" : "text-foreground-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav
      aria-label="Início e painel"
      className={cn("inline-flex items-center gap-1 rounded-full p-1", floating ? "bg-white/10 backdrop-blur" : "border border-border bg-surface")}
    >
      {tab("/inicio", "Início", active === "inicio")}
      {tab("/painel", "Painel", active === "painel")}
    </nav>
  );
}
