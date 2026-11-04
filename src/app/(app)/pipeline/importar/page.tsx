import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { PipelineImportWizard } from "./import-wizard";

export default async function ImportarPipelinePage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar a planilha de gestão do pipeline"
        description="Suba a planilha (.xlsx). O SIGO lê o plano de sucessão da aba Pipeline e o resultado do Ciclo de Gente da aba Ciclo de Gente, mostra o que entendeu e só grava depois que você confirmar. O tempo de casa não é importado: vem do cadastro de colaboradores."
      />
      <PageBody>
        <PipelineImportWizard />
      </PageBody>
    </>
  );
}
