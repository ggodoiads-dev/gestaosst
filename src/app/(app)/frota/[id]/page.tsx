import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getEquipmentDamageDetail } from "@/server/services/equipment-damage.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EquipmentDamageStatusBadge } from "@/components/domain/status-badges";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { DamageStatusActions } from "../damage-status-actions";
import { DamageAttachments } from "../damage-attachments";

export default async function FrotaDamageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const damage = await getEquipmentDamageDetail(user, id);

  return (
    <>
      <PageHeader
        title={damage.code}
        description={`${damage.equipment.code} — ${damage.equipment.name} · ${formatDate(damage.date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/frota">
                <ArrowLeft className="size-4" /> Voltar
              </Link>
            </Button>
            <EquipmentDamageStatusBadge status={damage.status} />
            <DamageStatusActions id={damage.id} status={damage.status} />
          </div>
        }
      />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-foreground-muted whitespace-pre-wrap">{damage.description}</p>
              {damage.notes && (
                <div>
                  <p className="text-xs text-foreground-subtle">Observações</p>
                  <p>{damage.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-foreground-subtle">Valor</p>
                <p className="tabular-nums">{formatCurrency(damage.cost ? Number(damage.cost) : null)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Responsável</p>
                <p>{damage.collaborator?.name ?? "Não apurado"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Reportado por</p>
                <p>{damage.reportedBy.name} em {formatDateTime(damage.reportedAt)}</p>
              </div>
              {damage.resolvedAt && (
                <div>
                  <p className="text-xs text-foreground-subtle">Resolvido em</p>
                  <p>{formatDateTime(damage.resolvedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Evidências ({damage.attachments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <DamageAttachments damageId={damage.id} attachments={damage.attachments} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
