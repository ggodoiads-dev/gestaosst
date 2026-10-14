import type { Metadata } from "next";
import Link from "next/link";
import { SIGO_COPYRIGHT_LINE, SIGO_TERMS_UPDATED_AT, SIGO_TERMS_VERSION } from "@/lib/legal";
import { TermsContent } from "@/components/domain/terms-content";

export const metadata: Metadata = {
  title: "Termos de Uso e Licença — SIGO",
  description: "Titularidade, licença de uso e condições de utilização do SIGO — Sistema Interno de Gestão Organizacional.",
};

/** Página pública (sem login): quem usa o sistema, ou quem só quer saber de quem ele é, precisa conseguir ler. */
export default function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand px-4 py-8 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">SIGO · Sistema Interno de Gestão Organizacional</p>
          <h1 className="mt-1 text-2xl font-bold">Termos de Uso e Licença</h1>
          <p className="mt-1 text-sm text-white/70">
            Versão {SIGO_TERMS_VERSION} · atualizados em {SIGO_TERMS_UPDATED_AT}
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <TermsContent />

        <footer className="flex flex-col gap-2 border-t border-border pt-4 text-center text-xs text-foreground-subtle">
          <p>{SIGO_COPYRIGHT_LINE}</p>
          <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
            Ir para o acesso ao sistema
          </Link>
        </footer>
      </main>
    </div>
  );
}
