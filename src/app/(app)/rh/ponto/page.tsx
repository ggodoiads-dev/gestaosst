import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { getTimeClockReport, getChecklistAdherence } from "@/server/services/time-clock.service";
import { PontoPanel } from "./ponto-panel";

function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function PontoPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);

  const [anomalies, adherence] = await Promise.all([
    getTimeClockReport(user, { from, to }),
    getChecklistAdherence(user, { from, to }),
  ]);

  return (
    <>
      <PageHeader
        title="Importar Ponto (AFDT)"
        description="Importe o arquivo AFDT do relógio de ponto e veja quem atrasou, faltou, esqueceu de bater o ponto ou não fez o checklist do dia."
      />
      <PageBody className="flex flex-col gap-6">
        <PontoPanel
          initialFrom={toInputValue(from)}
          initialTo={toInputValue(to)}
          initialAnomalies={anomalies}
          initialAdherence={adherence}
        />
      </PageBody>
    </>
  );
}
