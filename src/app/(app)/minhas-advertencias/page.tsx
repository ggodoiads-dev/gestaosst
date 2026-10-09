import { AlertOctagon } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMyCollaboratorProfile } from "@/server/services/productivity.service";
import { listMyWarnings } from "@/server/services/warning.service";
import { listMyWarningDocuments } from "@/server/services/absence-followup.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";

export default async function MinhasAdvertenciasPage() {
  const user = await requireUser();
  const collaborator = await getMyCollaboratorProfile(user);

  if (!collaborator) {
    return (
      <>
        <PageHeader title="Minhas Advertências" description="Advertências registradas em seu nome." />
        <PageBody>
          <Card>
            <CardContent className="py-10 text-center text-sm text-foreground-subtle">
              Seu usuário ainda não está vinculado a um colaborador. Peça pro seu gestor vincular seu acesso.
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const warnings = await listMyWarnings(user);
  const documents = await listMyWarningDocuments(user).catch(() => []);

  return (
    <>
      <PageHeader title="Minhas Advertências" description="Advertências registradas em seu nome." />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <AlertOctagon className="size-4" /> Advertências ({warnings?.length ?? 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {(!warnings || warnings.length === 0) && (
              <p className="text-sm text-foreground-subtle">Nenhuma advertência registrada.</p>
            )}
            {warnings?.map((warning) => (
              <div
                key={warning.id}
                className="flex items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatDate(warning.date)}</p>
                  <p className="text-xs text-foreground-subtle">{warning.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {documents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Documentos anexados pelo RH</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-md border border-border px-3 py-2.5 text-sm">
                  <p className="font-medium">Falta de {formatDate(doc.date)}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {doc.attachments.map((a) => (
                      <li key={a.id}>
                        <a href={attachmentUrl(a.path)} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                          {a.filename}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
