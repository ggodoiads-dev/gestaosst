import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarGuardianPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.GUARDIAN_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar Guardian"
        description="Envie a exportação diária do Guardian — só entram relatos de gente já cadastrada como colaborador da LOG20, e reimportar o mesmo arquivo nunca duplica (o ID da ocorrência do Guardian é a chave)."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
