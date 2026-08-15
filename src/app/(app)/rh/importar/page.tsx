import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarPlanilhaPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar Planilha"
        description="Atualize nome, matrícula, cargo e salário dos colaboradores a partir de uma planilha exportada do seu sistema."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
