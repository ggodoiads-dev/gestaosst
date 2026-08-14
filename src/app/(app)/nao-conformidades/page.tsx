import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listNonconformitiesForUser } from "@/server/services/nonconformity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/domain/clickable-row";
import { NonconformityStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { formatDateTime } from "@/lib/dates";

export default async function NaoConformidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; overdue?: string }>;
}) {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.NONCONFORMITY_VIEW);
  const { status, severity, overdue } = await searchParams;

  const items = await listNonconformitiesForUser(user, { status, severity, overdue: overdue === "true" });

  const filterLabel = overdue === "true"
    ? "Filtro: vencidas"
    : status || severity
      ? `Filtro: ${[status, severity].filter(Boolean).join(" · ").replaceAll("_", " ")}`
      : undefined;

  return (
    <>
      <PageHeader
        title="Não Conformidades"
        description={filterLabel ?? "Desvios identificados nos checklists, com rastreabilidade até a origem."}
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Identificada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && <TableEmpty colSpan={7} />}
                {items.map((nc) => (
                  <ClickableRow key={nc.id} href={`/nao-conformidades/${nc.id}`}>
                    <TableCell className="font-mono text-xs">{nc.code}</TableCell>
                    <TableCell>{nc.equipment.code} — {nc.equipment.name}</TableCell>
                    <TableCell>{nc.area.name}</TableCell>
                    <TableCell><CriticalityBadge value={nc.severity} /></TableCell>
                    <TableCell><NonconformityStatusBadge status={nc.status} /></TableCell>
                    <TableCell className="text-foreground-subtle">{nc.responsible?.name ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{formatDateTime(nc.identifiedAt)}</TableCell>
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
