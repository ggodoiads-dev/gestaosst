import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listActivitiesForUser, listLatestActivityDocuments } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateActivityDialog, EditActivityDialog } from "./activity-form-dialog";
import { DeleteActivityButton, ReactivateActivityButton } from "./activity-delete-button";

export default async function AtividadesPage() {
  const user = await requireUser();
  const activities = await listActivitiesForUser(user);
  const documents = await listLatestActivityDocuments(activities.map((a) => a.id));

  return (
    <>
      <PageHeader
        title="Atividades e Documentos"
        description="Cadastro das atividades da operação, cada uma com POP, AR/VR e lista de treinamento — substituíveis mantendo o histórico de versões."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Atividades ({activities.length})</CardTitle>
            <CreateActivityDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>POP</TableHead>
                  <TableHead>AR/VR</TableHead>
                  <TableHead>Lista de Treinamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.length === 0 && <TableEmpty colSpan={7} />}
                {activities.map((activity) => {
                  const docs = documents[activity.id] ?? { pop: false, arVr: false, listaTreinamento: false };
                  return (
                    <TableRow key={activity.id} className={!activity.active ? "opacity-60" : undefined}>
                      <TableCell>
                        <Link href={`/atividades/${activity.id}`} className="text-accent hover:underline">
                          {activity.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground-subtle">{activity.code ?? "—"}</TableCell>
                      <TableCell>
                        {docs.pop ? <Badge tone="success">OK</Badge> : <Badge tone="warning">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        {docs.arVr ? <Badge tone="success">OK</Badge> : <Badge tone="warning">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        {docs.listaTreinamento ? <Badge tone="success">OK</Badge> : <Badge tone="warning">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        {activity.active ? <Badge tone="success">Ativa</Badge> : <Badge tone="neutral">Excluída</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <EditActivityDialog activity={activity} />
                          {activity.active ? (
                            <DeleteActivityButton id={activity.id} name={activity.name} />
                          ) : (
                            <ReactivateActivityButton id={activity.id} name={activity.name} />
                          )}
                        </div>
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
