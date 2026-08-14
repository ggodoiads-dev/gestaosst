import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listMyExecutions } from "@/server/services/checklist-execution.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ExecutionStatusBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatMinutes } from "@/lib/dates";

const RESULT_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  LIBERADO: "success",
  LIBERADO_COM_OBSERVACAO: "info",
  RESTRITO: "warning",
  BLOQUEADO: "danger",
};

export default async function MeuHistoricoPage() {
  const user = await requireUser();
  const executions = await listMyExecutions(user);

  return (
    <>
      <PageHeader
        title="Meu Histórico"
        description="Checklists que você realizou, para confirmar suas próprias atividades."
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Iniciado em</TableHead>
                  <TableHead>Finalizado em</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 && <TableEmpty colSpan={7} />}
                {executions.map((exec) => (
                  <TableRow key={exec.id}>
                    <TableCell className="font-mono text-xs">{exec.code}</TableCell>
                    <TableCell>
                      <Link href={`/equipamentos/${exec.equipmentId}`} className="text-accent hover:underline">
                        {exec.equipment.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatDateTime(exec.startedAt)}</TableCell>
                    <TableCell className="text-foreground-subtle">{formatDateTime(exec.finishedAt)}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {exec.delayMinutes ? formatMinutes(exec.delayMinutes) : "No prazo"}
                    </TableCell>
                    <TableCell>
                      {exec.result && <Badge tone={RESULT_TONE[exec.result]}>{exec.result.replaceAll("_", " ")}</Badge>}
                    </TableCell>
                    <TableCell><ExecutionStatusBadge status={exec.status} /></TableCell>
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
