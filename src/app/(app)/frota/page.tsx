import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listEquipmentDamagesForUser, listCollaboratorsForDamageForm } from "@/server/services/equipment-damage.service";
import { listEquipmentsForUser } from "@/server/services/equipment.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { EquipmentDamageStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreateDamageDialog, EditDamageDialog } from "./damage-form-dialog";

const STATUS_FILTERS = [
  { key: "ativas", label: "Abertas", status: undefined },
  { key: "resolvidas", label: "Resolvidas", status: "RESOLVIDO" as const },
  { key: "todas", label: "Todas", status: "ALL" as const },
];

export default async function FrotaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status: statusParam } = await searchParams;
  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusParam) ?? STATUS_FILTERS[0]!;
  const filterStatus = activeFilter.status === undefined ? undefined : activeFilter.status === "ALL" ? "ALL" : activeFilter.status;

  const [damagesRaw, equipments, collaborators] = await Promise.all([
    listEquipmentDamagesForUser(user, { status: filterStatus }),
    listEquipmentsForUser(user),
    listCollaboratorsForDamageForm(user),
  ]);
  const damages =
    activeFilter.key === "ativas" ? damagesRaw.filter((d) => d.status !== "RESOLVIDO") : damagesRaw;

  const totalCost = damages.reduce((sum, d) => sum + (d.cost ? Number(d.cost) : 0), 0);

  return (
    <>
      <PageHeader
        title="Frota — Avarias"
        description="Registro de danos em empilhadeiras e outros equipamentos: quando aconteceu, quem foi, valor e evidências."
        actions={<CreateDamageDialog equipments={equipments} collaborators={collaborators} />}
      />
      <PageBody>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>
                Avarias ({damages.length}){totalCost > 0 && <span className="ml-2 font-normal text-foreground-subtle text-sm">· {formatCurrency(totalCost)} no filtro atual</span>}
              </CardTitle>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key === "ativas" ? "/frota" : `/frota?status=${f.key}`}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      activeFilter.key === f.key
                        ? "bg-accent-soft text-accent"
                        : "text-foreground-subtle hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {damages.length === 0 && <TableEmpty colSpan={7} />}
                {damages.map((damage) => (
                  <TableRow key={damage.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/frota/${damage.id}`} className="text-accent hover:underline">
                        {damage.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatDate(damage.date)}</TableCell>
                    <TableCell>{damage.equipment.code} — {damage.equipment.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{damage.collaborator?.name ?? "Não apurado"}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(damage.cost ? Number(damage.cost) : null)}</TableCell>
                    <TableCell><EquipmentDamageStatusBadge status={damage.status} /></TableCell>
                    <TableCell>
                      <EditDamageDialog damage={damage} equipments={equipments} collaborators={collaborators} />
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
