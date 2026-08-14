import Link from "next/link";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listActionItemsForUser } from "@/server/services/nonconformity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionItemStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";

export default async function PlanosDeAcaoPage({
  searchParams,
}: {
  searchParams: Promise<{ overdue?: string }>;
}) {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);
  const { overdue } = await searchParams;

  const items = await listActionItemsForUser(user, { overdue: overdue === "true" });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Planos de Ação"
        description="Ações corretivas originadas de não conformidades, por responsável e prazo."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NC</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && <TableEmpty colSpan={7} />}
                {items.map((item) => {
                  const overdue = item.status === "PENDENTE" && new Date(item.dueDate) < now;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/nao-conformidades/${item.actionPlan.nonconformity.id}`}
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          {item.actionPlan.nonconformity.code}
                        </Link>
                      </TableCell>
                      <TableCell>{item.actionPlan.nonconformity.equipment.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                      <TableCell className="text-foreground-subtle">{item.responsible.name}</TableCell>
                      <TableCell className="text-foreground-subtle">{formatDate(item.dueDate)}</TableCell>
                      <TableCell><Badge tone="neutral">{item.priority}</Badge></TableCell>
                      <TableCell>
                        {overdue ? <Badge tone="danger" dot>Vencida</Badge> : <ActionItemStatusBadge status={item.status} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
