import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { PontoPanel } from "./ponto-panel";

export default async function PontoPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  return (
    <>
      <PageHeader
        title="Importar Ponto"
        description="Importe o arquivo AEJ do relógio de ponto. Vincular batidas não identificadas e ver ocorrências (atraso, falta, checklist não realizado) fica em Tratativa de Ponto."
      />
      <PageBody className="flex flex-col gap-6">
        <PontoPanel />
      </PageBody>
    </>
  );
}
