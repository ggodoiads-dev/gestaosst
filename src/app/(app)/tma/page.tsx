import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { canImportTma, getTmaView } from "@/server/services/tma.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { TmaViewClient } from "./tma-view";

export default async function TmaPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser();
  const { periodo } = await searchParams;
  const view = await getTmaView(user, periodo);
  const canImport = canImportTma(user);
  const importButton = canImport ? (
    <Link href="/tma/importar" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
      <Upload className="size-4" /> Importar planilha
    </Link>
  ) : null;

  return (
    <>
      <PageHeader
        title="TMA — tempo de atendimento"
        description="Quanto tempo cada caminhão leva do atendimento à liberação, lido da planilha de controle (a mesma da Ambev). Alimenta o indicador de TMA do Cascateamento."
        actions={importButton}
      />
      <PageBody>
        {!view.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">O TMA ainda não foi ativado no banco de dados.</div>
        ) : !view.selected || !view.month || !view.ytd || !view.year ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center">
            <p className="text-sm text-foreground-subtle">Nenhum mês importado ainda. Envie a planilha TMA e escolha os meses.</p>
            {importButton}
          </div>
        ) : (
          <TmaViewClient months={view.months} selected={view.selected} year={view.year} month={view.month} ytd={view.ytd} importedAt={view.importedAt} />
        )}
      </PageBody>
    </>
  );
}
