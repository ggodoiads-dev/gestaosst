import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { searchExecutionHistory } from "@/server/services/checklist-execution.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ExecutionStatusBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatMinutes } from "@/lib/dates";

const RESULT_TONE: Record<string, "success" | "info" | "warning" | "danger"> = {
  LIBERADO: "success",
  LIBERADO_COM_OBSERVACAO: "info",
  RESTRITO: "warning",
  BLOQUEADO: "danger",
};

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const executions = await searchExecutionHistory(user, { search: q });

  return (
    <>
      <PageHeader
        title="Histórico Geral"
        description="Reconstrua qualquer ocorrência: equipamento, checklist, usuário e resultado."
      />
      <PageBody>
        <form className="max-w-sm">
          <Input name="q" defaultValue={q} placeholder="Buscar por equipamento ou código..." />
        </form>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Executado por</TableHead>
                  <TableHead>Finalizado em</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 && <TableEmpty colSpan={8} />}
                {executions.map((exec) => (
                  <TableRow key={exec.id}>
                    <TableCell className="font-mono text-xs">{exec.code}</TableCell>
                    <TableCell>
                      <Link href={`/equipamentos/${exec.equipmentId}`} className="text-accent hover:underline">
                        {exec.equipment.code}
                      </Link>
                    </TableCell>
                    <TableCell>{exec.equipment.area.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{exec.executedBy.name}</TableCell>
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
