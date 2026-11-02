import { Fragment } from "react";
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

  const OPEN = new Set(["ABERTA", "EM_ANALISE", "ACAO_DEFINIDA", "EM_EXECUCAO", "AGUARDANDO_VERIFICACAO"]);
  const byEquipment = new Map<string, { equipmentId: string; label: string; items: typeof items; openCount: number }>();
  for (const nc of items) {
    const g = byEquipment.get(nc.equipmentId) ?? { equipmentId: nc.equipmentId, label: `${nc.equipment.code} — ${nc.equipment.name}`, items: [], openCount: 0 };
    g.items.push(nc);
    if (OPEN.has(nc.status)) g.openCount++;
    byEquipment.set(nc.equipmentId, g);
  }
  // Equipamento com mais NCs abertas primeiro; dentro dele, as mais recentes no topo (a lista já vem por data).
  const groups = [...byEquipment.values()].sort((a, b) => b.openCount - a.openCount || b.items.length - a.items.length);

  return (
    <>
      <PageHeader
        title="Não Conformidades"
        description={filterLabel ?? "Desvios identificados nos checklists, agrupados por equipamento. Se a mesma pergunta reprova de novo com a NC aberta, não nasce outra NC: a reincidência fica registrada na ficha do equipamento."}
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Equip.</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Identificada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && <TableEmpty colSpan={7} />}
                {groups.map((g) => (
                  <Fragment key={g.equipmentId}>
                    <TableRow className="bg-surface-muted hover:bg-surface-muted">
                      <TableCell colSpan={7} className="py-2 text-xs font-semibold text-foreground">
                        {g.label} <span className="font-normal text-foreground-subtle">· {g.items.length} NC(s), {g.openCount} aberta(s)</span>
                      </TableCell>
                    </TableRow>
                    {g.items.map((nc) => (
                      <ClickableRow key={nc.id} href={`/nao-conformidades/${nc.id}`}>
                        <TableCell className="font-mono text-xs">{nc.code}</TableCell>
                        <TableCell className="text-foreground-subtle">{nc.equipment.code}</TableCell>
                        <TableCell>{nc.area.name}</TableCell>
                        <TableCell><CriticalityBadge value={nc.severity} /></TableCell>
                        <TableCell><NonconformityStatusBadge status={nc.status} /></TableCell>
                        <TableCell className="text-foreground-subtle">{nc.responsible?.name ?? "—"}</TableCell>
                        <TableCell className="text-foreground-subtle">{formatDateTime(nc.identifiedAt)}</TableCell>
                      </ClickableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
