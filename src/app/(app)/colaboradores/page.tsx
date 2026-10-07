import Link from "next/link";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listCollaboratorsUnified } from "@/server/services/collaborator.service";
import { listAreas } from "@/server/services/masterdata.service";
import { listTurnos } from "@/server/services/schedule.service";
import { listJobFunctionsForCollaboratorForm } from "@/server/services/epi.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { CreateCollaboratorDialog, EditCollaboratorDialog } from "./collaborator-form-dialog";
import { DeleteCollaboratorButton, ReactivateCollaboratorButton } from "./collaborator-delete-button";
import { EditSalaryDialog } from "./salary-dialog";
import { RequiresChecklistToggle } from "./requires-checklist-toggle";
import { BulkAccessButton } from "./bulk-access-button";

const STATUS_FILTERS = [
  { key: "ativos", label: "Ativos" },
  { key: "desligados", label: "Desligados" },
  { key: "todos", label: "Todos" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export default async function ColaboradoresPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: StatusFilter = STATUS_FILTERS.some((f) => f.key === status) ? (status as StatusFilter) : "ativos";
  const user = await requireUser();
  const canManage = hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);

  const [allCollaborators, areas, turnos, jobFunctions] = await Promise.all([
    listCollaboratorsUnified(user),
    listAreas(),
    listTurnos(user),
    listJobFunctionsForCollaboratorForm(user),
  ]);

  const counts: Record<StatusFilter, number> = {
    ativos: allCollaborators.filter((c) => c.active).length,
    desligados: allCollaborators.filter((c) => !c.active).length,
    todos: allCollaborators.length,
  };
  const collaborators = allCollaborators.filter((c) =>
    filter === "todos" ? true : filter === "ativos" ? c.active : !c.active,
  );

  const hasActionsColumn = canManage || canSeeHr;
  const columnCount = 8 + (canSeeHr ? 2 : 0) + (hasActionsColumn ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description={
          canSeeHr
            ? "Cadastro central dos funcionários da operação — dados de RH (salário) só aparecem pra quem tem esse acesso."
            : "Cadastro central dos funcionários da operação — alimenta acidentes, qualificações e o histórico de cada pessoa."
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Colaboradores ({collaborators.length})</CardTitle>
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-0.5 text-xs">
                {STATUS_FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key === "ativos" ? "/colaboradores" : `/colaboradores?status=${f.key}`}
                    className={
                      f.key === filter
                        ? "rounded bg-surface px-2.5 py-1 font-semibold text-foreground shadow-sm"
                        : "rounded px-2.5 py-1 text-foreground-subtle hover:text-foreground"
                    }
                  >
                    {f.label} ({counts[f.key]})
                  </Link>
                ))}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <BulkAccessButton />
                <CreateCollaboratorDialog areas={areas} turnos={turnos} jobFunctions={jobFunctions} />
              </div>
            )}
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
                  {canSeeHr && (
                    <>
                      <TableHead>Salário</TableHead>
                      <TableHead>Precisa de checklist</TableHead>
                    </>
                  )}
                  {hasActionsColumn && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {collaborators.length === 0 && <TableEmpty colSpan={columnCount} />}
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
                        <Badge tone="neutral">Desligado</Badge>
                      )}
                    </TableCell>
                    {canSeeHr && (
                      <>
                        <TableCell>
                          {collaborator.salary ? (
                            <span className="tabular-nums">{formatCurrency(Number(collaborator.salary))}</span>
                          ) : (
                            <Badge tone="neutral">Não definido</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <RequiresChecklistToggle
                            collaboratorId={collaborator.id}
                            defaultChecked={collaborator.requiresChecklist}
                          />
                        </TableCell>
                      </>
                    )}
                    {hasActionsColumn && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <EditCollaboratorDialog
                              collaborator={collaborator}
                              areas={areas}
                              turnos={turnos}
                              jobFunctions={jobFunctions}
                            />
                          )}
                          {canSeeHr && (
                            <EditSalaryDialog
                              collaboratorId={collaborator.id}
                              collaboratorName={collaborator.name}
                              currentSalary={collaborator.salary ? Number(collaborator.salary) : null}
                            />
                          )}
                          {canManage &&
                            (collaborator.active ? (
                              <DeleteCollaboratorButton id={collaborator.id} name={collaborator.name} />
                            ) : (
                              <ReactivateCollaboratorButton id={collaborator.id} name={collaborator.name} />
                            ))}
                        </div>
                      </TableCell>
                    )}
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
