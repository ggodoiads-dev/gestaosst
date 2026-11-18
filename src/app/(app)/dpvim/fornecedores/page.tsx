import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { canManageDpvim, getDpvimSuppliersOverview } from "@/server/services/dpvim.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { SuppliersManager } from "../suppliers-manager";

export default async function DpvimSuppliersPage() {
  const user = await requireUser();
  if (!canManageDpvim(user)) redirect("/dpvim");
  const data = await getDpvimSuppliersOverview(user);

  return (
    <>
      <PageHeader
        title="Fornecedores da DPVIM"
        description="De onde vêm as cargas: nome e unidade. É essa lista que aparece ao cadastrar uma DPVIM e que agrupa o painel de divergências."
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link href="/dpvim">
              <ChevronLeft className="size-4" /> Todas as DPVIM
            </Link>
          </Button>
        }
      />
      <PageBody>
        {!data.ready ? (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">A atualização do banco de dados dos fornecedores ainda não foi aplicada.</div>
        ) : (
          <SuppliersManager suppliers={data.suppliers} unregistered={data.unregistered} />
        )}
      </PageBody>
    </>
  );
}
