import { AlertOctagon } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMyCollaboratorProfile } from "@/server/services/productivity.service";
import { listMyWarnings } from "@/server/services/warning.service";
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
      </PageBody>
    </>
  );
}
