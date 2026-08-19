import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportarAcidentesPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.ACCIDENT_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar Acidentes"
        description="Cadastre em lote o histórico de acidentes a partir de uma planilha. Sem coluna de Status, os registros entram como Concluído (histórico já resolvido). Reimportar o mesmo arquivo duplica os registros — não há como casar uma linha da planilha com um acidente já cadastrado."
      />
      <PageBody>
        <ImportWizard />
      </PageBody>
    </>
  );
}
