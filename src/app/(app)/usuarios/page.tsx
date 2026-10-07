import Link from "next/link";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listUsers, listRoles } from "@/server/services/user.service";
import { listUnits, listAreas, listActiveJobFunctions } from "@/server/services/masterdata.service";
import { listTurnosForSelect } from "@/server/services/schedule.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { ROLE_LABELS, type RoleKeyValue } from "@/domain/shared/permissions";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setUserActiveAction } from "@/server/actions/user.actions";
import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from "./user-form-dialog";

const STATUS_FILTERS = [
  { key: "ativos", label: "Ativos" },
  { key: "excluidos", label: "Excluídos" },
  { key: "todos", label: "Todos" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter: StatusFilter = STATUS_FILTERS.some((f) => f.key === status) ? (status as StatusFilter) : "ativos";
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.USER_MANAGE);

  const [allUsers, roles, units, areas, functions, turnos] = await Promise.all([
    listUsers(),
    listRoles(),
    listUnits(),
    listAreas(),
    listActiveJobFunctions(),
    listTurnosForSelect(),
  ]);

  const counts: Record<StatusFilter, number> = {
    ativos: allUsers.filter((u) => u.active).length,
    excluidos: allUsers.filter((u) => !u.active).length,
    todos: allUsers.length,
  };
  const users = allUsers.filter((u) => (filter === "todos" ? true : filter === "ativos" ? u.active : !u.active));

  return (
    <>
      <PageHeader
        title="Usuários e Permissões"
        description="Controle de acesso ao sistema por perfil e área."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Usuários ({users.length})</CardTitle>
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-0.5 text-xs">
                {STATUS_FILTERS.map((f) => (
                  <Link
                    key={f.key}
                    href={f.key === "ativos" ? "/usuarios" : `/usuarios?status=${f.key}`}
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
            <CreateUserDialog roles={roles} units={units} areas={areas} functions={functions} turnos={turnos} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Áreas</TableHead>
                  <TableHead>Funções (líder)</TableHead>
                  <TableHead>Chamada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && <TableEmpty colSpan={9} />}
                {users.map((u) => (
                  <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{u.email}</TableCell>
                    <TableCell>{ROLE_LABELS[u.role.key as RoleKeyValue] ?? u.role.name}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {u.userAreas.length > 0
                        ? u.userAreas.map((ua) => ua.area.name).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">
                      {u.userFunctions.length > 0
                        ? u.userFunctions.map((uf) => uf.function.name).join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">
                      {u.canRollCall
                        ? u.userRollCallAreas.map((a) => a.area.name).join(", ") || "Sim (sem área)"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativo" : "Excluído"}</Badge>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatDateTime(u.lastLoginAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditUserDialog user={u} roles={roles} units={units} areas={areas} functions={functions} turnos={turnos} />
                        <ResetPasswordDialog userId={u.id} userName={u.name} />
                        {u.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${u.name}?`}
                            description="O usuário perde o acesso ao sistema imediatamente. Nada do que ele já registrou é apagado, e você pode reativá-lo depois."
                            ariaLabel="Excluir usuário"
                            successMessage={`${u.name} excluído.`}
                            onConfirm={setUserActiveAction.bind(null, u.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar usuário"
                            successMessage={`${u.name} reativado.`}
                            onConfirm={setUserActiveAction.bind(null, u.id, true)}
                          />
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
