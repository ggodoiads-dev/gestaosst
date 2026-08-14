import Link from "next/link";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listEquipmentTypes, listAreas } from "@/server/services/masterdata.service";
import { listAllEquipmentsForAdmin, listLatestEquipmentPhotos } from "@/server/services/equipment.service";
import { listActiveUsers } from "@/server/services/user.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { CreateEquipmentTypeDialog, EditEquipmentTypeDialog } from "./equipment-type-form-dialog";
import { CreateEquipmentDialog, EditEquipmentDialog } from "./equipment-form-dialog";
import { DeleteEquipmentButton, ReactivateEquipmentButton } from "./equipment-delete-button";

export default async function EquipamentosCadastroPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);

  const [types, areas, equipments, users] = await Promise.all([
    listEquipmentTypes(),
    listAreas(),
    listAllEquipmentsForAdmin(),
    listActiveUsers(),
  ]);
  const photos = await listLatestEquipmentPhotos(equipments.map((e) => e.id));

  return (
    <>
      <PageHeader
        title="Tipos de Equipamento e Equipamentos"
        description="Cadastro mestre de tipos de equipamento e dos equipamentos individuais da operação."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Tipos de equipamento</CardTitle>
            <CreateEquipmentTypeDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.length === 0 && <TableEmpty colSpan={4} />}
                {types.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-mono text-xs">{type.code}</TableCell>
                    <TableCell>{type.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{type.description ?? "—"}</TableCell>
                    <TableCell>
                      <EditEquipmentTypeDialog type={type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipamentos ({equipments.length})</CardTitle>
            <CreateEquipmentDialog types={types} areas={areas} users={users} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Criticidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipments.length === 0 && <TableEmpty colSpan={10} />}
                {equipments.map((equipment) => (
                  <TableRow key={equipment.id} className={!equipment.active ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="size-9 overflow-hidden rounded-md bg-surface-muted">
                        {photos[equipment.id] && (
                          // eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads
                          <img
                            src={attachmentUrl(photos[equipment.id])}
                            alt=""
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/equipamentos/${equipment.id}`} className="text-accent hover:underline">
                        {equipment.code}
                      </Link>
                    </TableCell>
                    <TableCell>{equipment.name}</TableCell>
                    <TableCell>{equipment.type.name}</TableCell>
                    <TableCell>{equipment.area.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{equipment.sector ?? "—"}</TableCell>
                    <TableCell><CriticalityBadge value={equipment.criticality} /></TableCell>
                    <TableCell>
                      {equipment.active ? (
                        <EquipmentStatusBadge status={equipment.status} />
                      ) : (
                        <Badge tone="neutral">Excluído</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{equipment.responsible?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditEquipmentDialog
                          equipment={equipment}
                          types={types}
                          areas={areas}
                          users={users}
                          photoUrl={photos[equipment.id] ? attachmentUrl(photos[equipment.id]) : null}
                        />
                        {equipment.active ? (
                          <DeleteEquipmentButton id={equipment.id} code={equipment.code} />
                        ) : (
                          <ReactivateEquipmentButton id={equipment.id} code={equipment.code} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
