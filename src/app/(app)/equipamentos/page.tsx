import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listEquipmentsForUser } from "@/server/services/equipment.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/domain/clickable-row";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { Input } from "@/components/ui/input";

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; criticality?: string }>;
}) {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.EQUIPMENT_VIEW);
  const { q, status, criticality } = await searchParams;

  const equipments = await listEquipmentsForUser(user, { search: q, status, criticality });

  const activeFilterLabel = status || criticality
    ? `Filtro: ${[status, criticality].filter(Boolean).join(" · ").replaceAll("_", " ")}`
    : undefined;

  return (
    <>
      <PageHeader
        title="Equipamentos"
        description={activeFilterLabel ?? "Situação atual dos equipamentos das suas áreas."}
      />
      <PageBody>
        <form className="max-w-sm">
          <Input name="q" defaultValue={q} placeholder="Buscar por código, nome ou patrimônio..." />
        </form>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Criticidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipments.length === 0 && <TableEmpty colSpan={8} />}
                {equipments.map((equipment) => (
                  <ClickableRow key={equipment.id} href={`/equipamentos/${equipment.id}`}>
                    <TableCell className="font-mono text-xs">{equipment.code}</TableCell>
                    <TableCell>{equipment.name}</TableCell>
                    <TableCell>{equipment.type.name}</TableCell>
                    <TableCell>{equipment.area.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{equipment.sector ?? "—"}</TableCell>
                    <TableCell><CriticalityBadge value={equipment.criticality} /></TableCell>
                    <TableCell><EquipmentStatusBadge status={equipment.status} /></TableCell>
                    <TableCell className="text-foreground-subtle">{equipment.responsible?.name ?? "—"}</TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
