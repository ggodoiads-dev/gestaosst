import { requireUser } from "@/server/auth/current-user";
import { getActivityDetail } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { EditActivityDialog } from "../activity-form-dialog";
import { DeleteActivityButton } from "../activity-delete-button";
import { ActivityDocumentUpload } from "../activity-document-upload";

export default async function AtividadeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const { activity, documents, currentPop, currentArVr, currentListaTreinamento } = await getActivityDetail(user, id);

  return (
    <>
      <PageHeader
        title={activity.name}
        description={activity.code ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {activity.active ? <Badge tone="success">Ativa</Badge> : <Badge tone="neutral">Excluída</Badge>}
            <EditActivityDialog activity={activity} />
            {activity.active && <DeleteActivityButton id={activity.id} name={activity.name} />}
          </div>
        }
      />
      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ActivityDocumentUpload activityId={activity.id} docType="POP" label="POP" current={currentPop} />
              <ActivityDocumentUpload activityId={activity.id} docType="AR_VR" label="AR/VR" current={currentArVr} />
              <ActivityDocumentUpload
                activityId={activity.id}
                docType="LISTA_TREINAMENTO"
                label="Lista de Treinamento"
                current={currentListaTreinamento}
              />
            </CardContent>
          </Card>

          {activity.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground-muted whitespace-pre-wrap">{activity.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de versões ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {documents.length === 0 && (
                <p className="text-sm text-foreground-subtle">Nenhum documento enviado ainda.</p>
              )}
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge tone={doc.docType === "POP" ? "info" : doc.docType === "AR_VR" ? "accent" : "warning"}>
                      {doc.docType === "POP" ? "POP" : doc.docType === "AR_VR" ? "AR/VR" : "Lista de Treinamento"}
                    </Badge>
                    <span className="text-xs text-foreground-subtle">{formatDateTime(doc.uploadedAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-foreground-muted">{doc.filename}</p>
                  <p className="text-xs text-foreground-subtle">por {doc.uploadedBy.name}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
