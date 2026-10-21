import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { getCascadeTree } from "@/server/services/cascade.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { CascadeTree } from "./cascade-tree";
import { SeedButton } from "./cascade-dialogs";

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[Number(m) - 1]}/${y}`;
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CascataPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser();
  const { periodo } = await searchParams;
  const { periodKey, roots, ready, canManage, owners } = await getCascadeTree(user, periodo);

  return (
    <>
      <PageHeader
        title="Cascateamento de metas"
        description="Do sonho ao dia a dia: cada IC (o quê — o resultado) abre em IVs (como — o processo que fecha a meta), e cada IV pode abrir de novo, até a rotina de uma pessoa."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/cascata?periodo=${shiftMonth(periodKey, -1)}`} className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted">
              ‹
            </Link>
            <span className="min-w-32 text-center text-sm font-medium capitalize">{monthLabel(periodKey)}</span>
            <Link href={`/cascata?periodo=${shiftMonth(periodKey, 1)}`} className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-muted">
              ›
            </Link>
          </div>
        }
      />
      <PageBody>
        {!ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            O cascateamento ainda não foi ativado no banco de dados.
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center">
            <p className="text-sm text-foreground-subtle">Nada cadastrado ainda. Carregue a estrutura inicial: o Sonho, os 5 pilares e os 36 ICs da planilha SWOT, com 3 deles já abertos em IVs (DTO, QLP Relatando e Checklist de empilhadeira).</p>
            {canManage ? <SeedButton /> : <p className="text-xs text-foreground-subtle">Peça ao gerente para carregar a estrutura.</p>}
          </div>
        ) : (
          <CascadeTree roots={roots} periodKey={periodKey} canManage={canManage} owners={owners} />
        )}
      </PageBody>
    </>
  );
}
