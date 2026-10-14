import Link from "next/link";
import { cn } from "@/lib/utils";
import { SIGO_COPYRIGHT_LINE } from "@/lib/legal";

/** Aviso de direitos autorais do SIGO, com link pros Termos de Uso e Licença (página pública). */
export function CopyrightNotice({ className, href = "/termos" }: { className?: string; href?: string }) {
  return (
    <p className={cn("text-center text-xs text-foreground-subtle", className)}>
      SIGO — Sistema Interno de Gestão Organizacional. {SIGO_COPYRIGHT_LINE}{" "}
      <Link href={href} className="underline underline-offset-2 hover:text-foreground">
        Termos de Uso e Licença
      </Link>
    </p>
  );
}
