import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { globalSearch } from "@/server/services/search.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EquipmentStatusBadge, NonconformityStatusBadge } from "@/components/domain/status-badges";

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const results = await globalSearch(user, q);
  const hasResults = results.equipments.length > 0 || results.nonconformities.length > 0;

  return (
    <>
      <PageHeader title={`Resultados para "${q}"`} description="Equipamentos e não conformidades correspondentes." />
      <PageBody>
        {!hasResults && (
          <p className="text-sm text-foreground-subtle">Nenhum resultado encontrado para esta busca.</p>
        )}

        {results.equipments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {results.equipments.map((eq) => (
                <Link
                  key={eq.id}
                  href={`/equipamentos/${eq.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-muted"
                >
                  <span>{eq.code} — {eq.name} <span className="text-foreground-subtle">({eq.area.name})</span></span>
                  <EquipmentStatusBadge status={eq.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {results.nonconformities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Não conformidades</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {results.nonconformities.map((nc) => (
                <Link
                  key={nc.id}
                  href={`/nao-conformidades/${nc.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-muted"
                >
                  <span className="font-mono text-xs">{nc.code}</span>
                  <span className="flex-1 px-3 truncate">{nc.equipment.code} — {nc.equipment.name}</span>
                  <NonconformityStatusBadge status={nc.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
