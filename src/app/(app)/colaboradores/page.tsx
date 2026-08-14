import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { listAreas } from "@/server/services/masterdata.service";
import { listTurnos } from "@/server/services/schedule.service";
import { listJobFunctionsForCollaboratorForm } from "@/server/services/epi.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { CreateCollaboratorDialog, EditCollaboratorDialog } from "./collaborator-form-dialog";
import { DeleteCollaboratorButton, ReactivateCollaboratorButton } from "./collaborator-delete-button";

export default async function ColaboradoresPage() {
  const user = await requireUser();

  const [collaborators, areas, turnos, jobFunctions] = await Promise.all([
    listCollaboratorsForUser(user),
    listAreas(),
    listTurnos(user),
    listJobFunctionsForCollaboratorForm(user),
  ]);

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description="Cadastro central dos funcionários da operação — alimenta acidentes, qualificações e o histórico de cada pessoa."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Colaboradores ({collaborators.length})</CardTitle>
            <CreateCollaboratorDialog areas={areas} turnos={turnos} jobFunctions={jobFunctions} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.length === 0 && <TableEmpty colSpan={9} />}
                {collaborators.map((collaborator) => (
                  <TableRow key={collaborator.id} className={!collaborator.active ? "opacity-60" : undefined}>
                    <TableCell>
                      <Link href={`/colaboradores/${collaborator.id}`} className="text-accent hover:underline">
                        {collaborator.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground-subtle">
                      {collaborator.matricula ?? "—"}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{collaborator.cargo ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{collaborator.area?.name ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {collaborator.turno ? `Turno ${collaborator.turno.name}` : "—"}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatDate(collaborator.admissionDate)}</TableCell>
                    <TableCell>
                      {collaborator.user ? (
                        <Badge tone="success">Login</Badge>
                      ) : collaborator.checklistEnabled ? (
                        <Badge tone="warning">Pendente</Badge>
                      ) : (
                        <span className="text-foreground-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {collaborator.active ? (
                        <Badge tone="success">Ativo</Badge>
                      ) : (
                        <Badge tone="neutral">Excluído</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditCollaboratorDialog
                          collaborator={collaborator}
                          areas={areas}
                          turnos={turnos}
                          jobFunctions={jobFunctions}
                        />
                        {collaborator.active ? (
                          <DeleteCollaboratorButton id={collaborator.id} name={collaborator.name} />
                        ) : (
                          <ReactivateCollaboratorButton id={collaborator.id} name={collaborator.name} />
                        )}
                      </div>
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
