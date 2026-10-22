import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { canLogProduction, getProductionView } from "@/server/services/production.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ProductionViewClient } from "./production-view";

export default async function ProducaoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser();
  const { periodo } = await searchParams;
  const view = await getProductionView(user, periodo);
  const canLog = canLogProduction(user);
  const launchButton = canLog ? (
    <Link href="/producao/lancar" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
      <Plus className="size-4" /> Lançar turno
    </Link>
  ) : null;

  return (
    <>
      <PageHeader
        title="Produção"
        description="Carros trabalhados, amarrados e carregados, cargas e descargas, por dia e por turno. Lançado pelo líder ao fim de cada turno."
        actions={launchButton}
      />
      <PageBody>
        {!view.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">A produção por turno ainda não foi ativada no banco de dados.</div>
        ) : (
          <ProductionViewClient months={view.months} selected={view.selected} year={view.year} month={view.month} ytd={view.ytd} reports={view.reports} canLog={canLog} />
        )}
      </PageBody>
    </>
  );
}
