import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarEquipamentosPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar Equipamentos"
        description="Cadastre ou atualize equipamentos em lote a partir de uma planilha. O Tipo é criado automaticamente se ainda não existir; a Área precisa já estar cadastrada."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
