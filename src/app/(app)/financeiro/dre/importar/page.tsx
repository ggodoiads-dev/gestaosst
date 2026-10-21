import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarDrePage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  return (
    <>
      <PageHeader
        title="Importar DRE"
        description='Arquivo "Demonstrativo de Resultados" exportado da plataforma financeira, de janeiro até o mês atual. Meses que já estão no SIGO são substituídos.'
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
