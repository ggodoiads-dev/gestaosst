import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarDtoPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.DTO_MANAGE);
  return (
    <>
      <PageHeader
        title="Importar DTO"
        description="Planilha do relatório detalhado de DTO exportada do DMPeople. Só entram avaliações de colaboradores cadastrados no SIGO."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
