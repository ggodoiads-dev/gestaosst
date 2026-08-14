import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listMaintenanceQueue } from "@/server/services/maintenance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { StartMaintenanceDialog, CompleteMaintenanceDialog } from "./maintenance-dialogs";

export default async function ManutencaoPage() {
  const user = await requireUser();
  const equipments = await listMaintenanceQueue(user);

  return (
    <>
      <PageHeader
        title="Manutenção"
        description="Equipamentos bloqueados, restritos ou em manutenção neste momento."
      />
      <PageBody>
        {equipments.length === 0 && (
          <p className="text-sm text-foreground-subtle">
            Nenhum equipamento precisa de manutenção agora. Tudo liberado.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {equipments.map((equipment) => (
            <Card key={equipment.id}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/equipamentos/${equipment.id}`} className="font-medium text-foreground hover:underline">
                      {equipment.code} — {equipment.name}
                    </Link>
                    <EquipmentStatusBadge status={equipment.status} />
                    <CriticalityBadge value={equipment.criticality} />
                  </div>
                  <p className="text-xs text-foreground-subtle">
                    {equipment.area.name} · {equipment.type.name}
                    {equipment.responsible && <> · Responsável: {equipment.responsible.name}</>}
                  </p>
                  {equipment.nonconformities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {equipment.nonconformities.map((nc) => (
                        <Link
                          key={nc.id}
                          href={`/nao-conformidades/${nc.id}`}
                          className="text-xs font-mono text-accent hover:underline"
                        >
                          {nc.code}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {equipment.status === "EM_MANUTENCAO" ? (
                    <CompleteMaintenanceDialog equipmentId={equipment.id} code={equipment.code} />
                  ) : (
                    <StartMaintenanceDialog equipmentId={equipment.id} code={equipment.code} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
