import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarDesligamentosPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar desligamentos"
        description="Suba o relatório de desligamentos do RH (.xlsx ou .csv). Cada linha é ligada ao cadastro pela matrícula ou pelo nome inteiro. Reimportar o mesmo arquivo não duplica: linhas que já estão no SIGO são ignoradas, então dá para importar o relatório acumulado todo mês."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
