import Link from "next/link";
import { headers } from "next/headers";
import { ClipboardCheck, Printer } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { db } from "@/server/db";
import { getEquipmentProntuario } from "@/server/services/equipment.service";
import { generateEquipmentQrCode } from "@/server/services/qrcode.service";
import { listEquipmentTypes, listAreas } from "@/server/services/masterdata.service";
import { listActiveUsers } from "@/server/services/user.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EquipmentStatusBadge, CriticalityBadge, NonconformityStatusBadge } from "@/components/domain/status-badges";
import { EquipmentTimeline } from "@/components/domain/equipment-timeline";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDate } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";
import { EditEquipmentDialog } from "@/app/(app)/cadastros/equipamentos/equipment-form-dialog";
import { DeleteEquipmentButton } from "@/app/(app)/cadastros/equipamentos/equipment-delete-button";
import { StartMaintenanceDialog, CompleteMaintenanceDialog } from "@/app/(app)/manutencao/maintenance-dialogs";

export default async function EquipamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const { equipment, lastExecution, openNonconformities, openActionItems, timeline, photo } =
    await getEquipmentProntuario(user, id);
  const photoUrl = photo ? attachmentUrl(photo.path) : null;

  const canManage = hasPermission(user, PERMISSIONS.EQUIPMENT_MANAGE);
  const [types, areas, users] = canManage
    ? await Promise.all([listEquipmentTypes(), listAreas(), listActiveUsers()])
    : [[], [], []];

  const canMaintain =
    hasPermission(user, PERMISSIONS.EQUIPMENT_MAINTENANCE) &&
    (hasPermission(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS) || user.areaIds.has(equipment.areaId));

  const canExecuteHere =
    equipment.active &&
    hasPermission(user, PERMISSIONS.CHECKLIST_EXECUTE) &&
    (hasPermission(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS) || user.areaIds.has(equipment.areaId));
  const hasActiveChecklist = canExecuteHere
    ? await db.equipmentChecklistAssignment.findFirst({
        where: {
          equipmentId: equipment.id,
          active: true,
          template: { versions: { some: { status: "ATIVA" } } },
        },
      })
    : null;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  const qrDataUrl = await generateEquipmentQrCode(equipment.qrToken, baseUrl);
  const qrUrl = `${baseUrl}/q/${equipment.qrToken}`;

  return (
    <>
      <PageHeader
        title={`${equipment.code} — ${equipment.name}`}
        description={`${equipment.type.name} · ${equipment.area.name}${equipment.sector ? ` / ${equipment.sector}` : ""} (${equipment.unit.name})`}
        actions={
          <div className="flex items-center gap-2">
            <CriticalityBadge value={equipment.criticality} />
            <EquipmentStatusBadge status={equipment.status} />
            {canManage && (
              <EditEquipmentDialog equipment={equipment} types={types} areas={areas} users={users} photoUrl={photoUrl} />
            )}
            {canManage && equipment.active && (
              <DeleteEquipmentButton id={equipment.id} code={equipment.code} />
            )}
            {canMaintain && equipment.active && equipment.status === "EM_MANUTENCAO" && (
              <CompleteMaintenanceDialog equipmentId={equipment.id} code={equipment.code} />
            )}
            {canMaintain &&
              equipment.active &&
              (equipment.status === "BLOQUEADO" || equipment.status === "RESTRITO") && (
                <StartMaintenanceDialog equipmentId={equipment.id} code={equipment.code} />
              )}
            {hasActiveChecklist && (
              <Button asChild size="sm">
                <Link href={`/checklist/realizar/${equipment.id}`}>
                  <ClipboardCheck /> Realizar Checklist
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Identificação</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {photoUrl && (
                <div className="col-span-2">
                  <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads */}
                    <img
                      src={photoUrl}
                      alt={`Foto do equipamento ${equipment.code}`}
                      className="h-40 w-auto rounded-md border border-border object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              )}
              <div>
                <p className="text-xs text-foreground-subtle">Patrimônio</p>
                <p>{equipment.assetTag ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Fabricante / Modelo</p>
                <p>{[equipment.manufacturer, equipment.model].filter(Boolean).join(" / ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Número de série</p>
                <p>{equipment.serialNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Responsável</p>
                <p>{equipment.responsible?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Área</p>
                <p>{equipment.area.name}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Setor</p>
                <p>{equipment.sector ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Último checklist</p>
                <p>
                  {lastExecution
                    ? `${formatDateTime(lastExecution.finishedAt)} — ${lastExecution.executedBy.name}`
                    : "Nenhum ainda"}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Cadastrado em</p>
                <p>{formatDate(equipment.registeredAt)}</p>
              </div>
              {equipment.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-foreground-subtle">Observações</p>
                  <p>{equipment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <EquipmentTimeline events={timeline} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Não conformidades abertas ({openNonconformities.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {openNonconformities.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhuma pendência.</p>
              )}
              {openNonconformities.map((nc) => (
                <Link
                  key={nc.id}
                  href={`/nao-conformidades/${nc.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                >
                  <span className="font-mono text-xs">{nc.code}</span>
                  <NonconformityStatusBadge status={nc.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações abertas ({openActionItems.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {openActionItems.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhuma ação pendente.</p>
              )}
              {openActionItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/nao-conformidades/${item.actionPlan.nonconformity.id}`}
                  className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                >
                  <span className="truncate">{item.description}</span>
                  <span className="text-xs text-foreground-subtle">
                    {item.responsible.name} · até {formatDate(item.dueDate)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/equipamentos/${equipment.id}/qrcode/imprimir`} target="_blank">
                  <Printer className="size-3.5" /> Imprimir
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR Code do equipamento ${equipment.code}`} className="size-40" />
              <p className="text-xs text-foreground-subtle text-center break-all">{qrUrl}</p>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
