import { requireUser } from "@/server/auth/current-user";
import { getTodayRollCall } from "@/server/services/attendance-rollcall.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RollCallForm } from "./rollcall-form";

export default async function ChamadaPage() {
  const user = await requireUser();
  const entries = await getTodayRollCall(user);

  return (
    <>
      <PageHeader
        title="Fazer Chamada"
        description="Confirme quem está presente hoje — quem faltar já entra direto na escala."
      />
      <PageBody>
        <Card>
          <CardContent className="pt-5">
            {entries.length === 0 ? (
              <p className="text-sm text-foreground-subtle">Ninguém escalado pra trabalhar hoje na sua equipe.</p>
            ) : (
              <RollCallForm entries={entries} />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
