import { requireUser } from "@/server/auth/current-user";
import { listCollaboratorsForHr } from "@/server/services/collaborator.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { EditSalaryDialog } from "./salary-dialog";

export default async function RhPage() {
  const user = await requireUser();
  const collaborators = await listCollaboratorsForHr(user, { onlyActive: true });

  return (
    <>
      <PageHeader
        title="Colaboradores (RH)"
        description="Dados sensíveis de folha — salário só é visível pra quem tem acesso de RH."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Colaboradores ({collaborators.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.length === 0 && <TableEmpty colSpan={6} />}
                {collaborators.map((collaborator) => (
                  <TableRow key={collaborator.id}>
                    <TableCell className="font-medium text-foreground">{collaborator.name}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground-subtle">
                      {collaborator.matricula ?? "—"}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{collaborator.cargo ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{collaborator.area?.name ?? "—"}</TableCell>
                    <TableCell>
                      {collaborator.salary ? (
                        <span className="tabular-nums">{formatCurrency(Number(collaborator.salary))}</span>
                      ) : (
                        <Badge tone="neutral">Não definido</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <EditSalaryDialog
                        collaboratorId={collaborator.id}
                        collaboratorName={collaborator.name}
                        currentSalary={collaborator.salary ? Number(collaborator.salary) : null}
                      />
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

