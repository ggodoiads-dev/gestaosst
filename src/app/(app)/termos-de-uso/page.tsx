import type { Metadata } from "next";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { TermsContent } from "@/components/domain/terms-content";
import { SIGO_COPYRIGHT_LINE, SIGO_TERMS_UPDATED_AT, SIGO_TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de Uso e Licença — SIGO" };

export default function TermosDeUsoPage() {
  return (
    <>
      <PageHeader
        title="Termos de Uso e Licença"
        description={`SIGO · versão ${SIGO_TERMS_VERSION} · atualizados em ${SIGO_TERMS_UPDATED_AT}`}
      />
      <PageBody>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <TermsContent />
          <p className="border-t border-border pt-4 text-center text-xs text-foreground-subtle">{SIGO_COPYRIGHT_LINE}</p>
        </div>
      </PageBody>
    </>
  );
}
