import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { getExitSurvey } from "@/server/services/exit-survey.service";
import { SurveyWizard } from "./survey-wizard";

export default async function ResumoEntrevistasPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const saved = await getExitSurvey();

  return (
    <>
      <PageHeader
        title="Resumo das entrevistas de desligamento"
        description="Quando a plataforma de entrevistas só entrega tabelas somadas (e não uma linha por pessoa), suba aqui. Aceita a tabela de motivos por tempo de casa e a de satisfação por categoria. Elas aparecem no PDCA do turnover como leitura externa, separadas das entrevistas registradas por pessoa."
      />
      <PageBody>
        <SurveyWizard
          saved={{
            motivos: saved.motivos ? { periodLabel: saved.motivos.periodLabel, updatedAt: saved.motivos.updatedAt.toISOString(), data: saved.motivos.data } : null,
            satisfacao: saved.satisfacao ? { periodLabel: saved.satisfacao.periodLabel, updatedAt: saved.satisfacao.updatedAt.toISOString(), data: saved.satisfacao.data } : null,
          }}
        />
      </PageBody>
    </>
  );
}
