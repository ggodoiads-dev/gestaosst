import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/server/auth/current-user";
import { canLogProduction, listLoggableTurnos } from "@/server/services/production.service";
import { isWarehouseHelper } from "@/domain/production/helpers";
import { listActiveCollaboratorsForSupervision } from "@/server/services/collaborator.service";
import { listActiveActivitiesForProductivityLog } from "@/server/services/activity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { APP_TIMEZONE } from "@/lib/dates";
import { LaunchForm } from "./launch-form";

export default async function LancarProducaoPage({ searchParams }: { searchParams: Promise<{ dia?: string; turno?: string }> }) {
  const user = await requireUser();
  if (!canLogProduction(user)) redirect("/producao");
  const { dia, turno } = await searchParams;
  const [turnos, collaborators, activities] = await Promise.all([
    listLoggableTurnos(user),
    listActiveCollaboratorsForSupervision(user).catch(() => []),
    listActiveActivitiesForProductivityLog(user).catch(() => []),
  ]);
  const helpers = collaborators.filter(isWarehouseHelper).map((c) => ({ id: c.id, name: c.name }));
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const initialDay = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= today ? dia : today;
  const initialTurnoId = turnos.find((t) => t.name === turno)?.id ?? turnos[0]?.id ?? "";

  return (
    <>
      <PageHeader
        title="Lançar produção do turno"
        description="Um relatório por dia e turno: carros trabalhados, amarrados e carregados, cargas, descargas e observações. É o mesmo conteúdo da mensagem de fim de turno."
      />
      <PageBody>
        {turnos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">Nenhum turno disponível para lançar.</div>
        ) : (
          <LaunchForm turnos={turnos} today={today} initialDay={initialDay} initialTurnoId={initialTurnoId} helpers={helpers} activities={activities.map((a) => ({ id: a.id, name: a.name }))} />
        )}
      </PageBody>
    </>
  );
}
