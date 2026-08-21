import { requireUser } from "@/server/auth/current-user";
import { listScheduleTypes, listTurnos } from "@/server/services/schedule.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setScheduleTypeActiveAction } from "@/server/actions/schedule.actions";
import { formatDate } from "@/lib/dates";
import { CreateScheduleTypeDialog, EditScheduleTypeDialog } from "./schedule-type-form-dialog";
import { CreateTurnoDialog, EditTurnoDialog } from "./turno-form-dialog";

export default async function EscalasCadastroPage() {
  const user = await requireUser();
  const [types, turnos] = await Promise.all([listScheduleTypes(user), listTurnos(user)]);
  const activeTypes = types.filter((t) => t.active);

  return (
    <>
      <PageHeader
        title="Tipos de Escala e Turnos"
        description="Catálogo de ciclos de trabalho/folga (ex: 6x2) e os turnos (A, B, C) que os colaboradores podem ser atribuídos."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Tipos de escala ({types.length})</CardTitle>
            <CreateScheduleTypeDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Dias de trabalho</TableHead>
                  <TableHead>Dias de folga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.length === 0 && <TableEmpty colSpan={5} />}
                {types.map((type) => (
                  <TableRow key={type.id} className={!type.active ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{type.workDays}</TableCell>
                    <TableCell className="text-foreground-subtle">{type.restDays}</TableCell>
                    <TableCell>
                      <Badge tone={type.active ? "success" : "neutral"}>{type.active ? "Ativo" : "Excluído"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditScheduleTypeDialog type={type} />
                        {type.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${type.name}?`}
                            description="Deixa de aparecer como opção pra novos turnos. Turnos já criados com esse tipo continuam funcionando, e você pode reativá-lo depois."
                            ariaLabel="Excluir tipo de escala"
                            successMessage={`${type.name} excluído.`}
                            onConfirm={setScheduleTypeActiveAction.bind(null, type.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar tipo de escala"
                            successMessage={`${type.name} reativado.`}
                            onConfirm={setScheduleTypeActiveAction.bind(null, type.id, true)}
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

        <Card>
          <CardHeader>
            <CardTitle>Turnos ({turnos.length})</CardTitle>
            <CreateTurnoDialog scheduleTypes={activeTypes} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turno</TableHead>
                  <TableHead>Tipo de escala</TableHead>
                  <TableHead>Início do ciclo</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Bate ponto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnos.length === 0 && <TableEmpty colSpan={6} />}
                {turnos.map((turno) => (
                  <TableRow key={turno.id}>
                    <TableCell className="font-medium">Turno {turno.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{turno.scheduleType.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{formatDate(turno.startDate)}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {turno.startTime && turno.endTime ? `${turno.startTime} às ${turno.endTime}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={turno.usesTimeClock ? "success" : "neutral"}>{turno.usesTimeClock ? "Sim" : "Não"}</Badge>
                    </TableCell>
                    <TableCell>
                      <EditTurnoDialog turno={turno} scheduleTypes={types} />
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
