import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { canImportDpvim } from "@/server/services/dpvim-import.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { DpvimImportWizard } from "./import-wizard";

export default async function ImportarDpvimPage() {
  const user = await requireUser();
  const allowed = await canImportDpvim(user);

  return (
    <>
      <PageHeader
        title="Importar DPVIM"
        description="Crie as DPVIM em aberto de uma vez a partir da planilha das notas pendentes de VIM, sem lançar uma por uma."
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href="/dpvim">
              <ChevronLeft className="size-4" /> Todas as DPVIM
            </Link>
          </Button>
        }
      />
      <PageBody>
        {allowed ? (
          <DpvimImportWizard />
        ) : (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            Só quem lança DPVIM e vê a nota pode importar, porque a planilha traz a quantidade da nota. Peça ao administrador para liberar em Usuários e Permissões.
          </div>
        )}
      </PageBody>
    </>
  );
}
