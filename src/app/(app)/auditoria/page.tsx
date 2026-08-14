import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listAuditLogs } from "@/server/services/audit-log.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";

const ACTION_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  CREATE: "success",
  UPDATE: "info",
  STATUS_CHANGE: "info",
  BLOCK: "danger",
  RELEASE: "success",
  CANCEL: "neutral",
  INVALIDATE: "danger",
  TRANSFER_AREA: "info",
  CHANGE_DUE_DATE: "info",
  CHANGE_RESPONSIBLE: "info",
  LOGIN: "neutral",
  PUBLISH_VERSION: "success",
};

export default async function AuditoriaPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.AUDIT_VIEW);

  const logs = await listAuditLogs();

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro de todas as alterações relevantes realizadas no sistema."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && <TableEmpty colSpan={5} />}
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-foreground-subtle">{formatDateTime(log.occurredAt)}</TableCell>
                    <TableCell>{log.user?.name ?? "Sistema"}</TableCell>
                    <TableCell><Badge tone={ACTION_TONE[log.action] ?? "neutral"}>{log.action}</Badge></TableCell>
                    <TableCell>{log.entityType}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground-subtle">{log.entityId.slice(0, 8)}</TableCell>
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
