import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarQualificacoesPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.QUALIFICATION_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar ASOs e NRs"
        description="Lance em lote treinamentos, ASOs e integrações a partir de uma planilha. Treinamentos novos são cadastrados automaticamente e o vencimento é calculado pela validade informada."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
