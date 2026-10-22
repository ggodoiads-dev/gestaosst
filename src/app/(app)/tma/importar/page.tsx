import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError } from "@/server/auth/current-user";
import { canImportTma } from "@/server/services/tma.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarTmaPage() {
  const user = await requireUser();
  if (!canImportTma(user)) throw new ForbiddenError();
  return (
    <>
      <PageHeader
        title="Importar planilha TMA"
        description="O arquivo da planilha de controle de atendimento (.xlsm ou .xlsx). Cada aba de mês (TMA OUT-26...) vira um mês; importar de novo um mês que já existe substitui ele."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
