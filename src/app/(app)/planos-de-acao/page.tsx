import Link from "next/link";
import { requireUser, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listActionItemsForUser } from "@/server/services/nonconformity.service";
import { listDtoActions } from "@/server/services/dto-action.service";
import { DtoActionsTable } from "./dto-actions-table";
import { cn } from "@/lib/utils";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionItemStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";

export default async function PlanosDeAcaoPage({
  searchParams,
}: {
  searchParams: Promise<{ overdue?: string; aba?: string }>;
}) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.ACTIONPLAN_MANAGE) && !hasPermission(user, PERMISSIONS.ACTIONPLAN_VIEW)) {
    throw new ForbiddenError();
  }
  const { overdue, aba } = await searchParams;
  const tab = aba === "dto" ? "dto" : "nc";

  const [items, dtoActions] = await Promise.all([listActionItemsForUser(user, { overdue: overdue === "true" }), listDtoActions(user)]);
  const openDtoActions = dtoActions.filter((a) => a.status !== "CONCLUIDA" && a.status !== "CANCELADA").length;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Planos de Ação"
        description="Ações corretivas originadas de não conformidades e dos DTOs, por responsável e prazo."
      />
      <PageBody>
        <div className="flex gap-1 border-b border-border">
          {[
            { key: "nc", label: "Não conformidades", href: "/planos-de-acao" },
            { key: "dto", label: `Ações de DTO (${openDtoActions})`, href: "/planos-de-acao?aba=dto" },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key ? "border-accent text-foreground" : "border-transparent text-foreground-subtle hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tab === "dto" ? (
          <DtoActionsTable rows={dtoActions} canManage={hasPermission(user, PERMISSIONS.ACTIONPLAN_MANAGE)} />
        ) : (
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
        )}
      </PageBody>
    </>
  );
}
