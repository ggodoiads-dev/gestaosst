import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getDreView } from "@/server/services/dre.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { DreViewClient } from "./dre-view";

export default async function DrePage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const view = await getDreView(user);

  return (
    <>
      <PageHeader
        title="DRE"
        description="Demonstrativo de Resultados importado da plataforma financeira. Os indicadores financeiros do Cascateamento leem daqui."
        actions={
          <Link href="/financeiro/dre/importar" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
            <Upload className="size-4" /> Importar DRE
          </Link>
        }
      />
      <PageBody>
        {!view.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            O DRE ainda não foi ativado no banco de dados.
          </div>
        ) : view.months.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center">
            <p className="text-sm text-foreground-subtle">Nenhum DRE importado ainda. Exporte o DRE da plataforma financeira (janeiro até o mês atual) e importe aqui.</p>
            <Link href="/financeiro/dre/importar" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
              <Upload className="size-4" /> Importar DRE
            </Link>
          </div>
        ) : (
          <DreViewClient view={view} />
        )}
      </PageBody>
    </>
  );
}
