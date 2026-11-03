import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { InterviewImportWizard } from "./import-wizard";

export default async function ImportarEntrevistasPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar entrevistas de desligamento"
        description="Suba a planilha das entrevistas (.xlsx ou .csv). Cada linha é ligada ao desligamento já importado, pela matrícula ou pelo nome, então importe os desligamentos antes. O motivo escrito em texto livre é classificado pelo SIGO (salário, liderança, escala, proposta melhor...) e você confere tudo antes de confirmar. Se a pessoa já tem entrevista, ela é atualizada."
      />
      <PageBody>
        <InterviewImportWizard />
      </PageBody>
    </>
  );
}
