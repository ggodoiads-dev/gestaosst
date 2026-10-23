import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser } from "@/server/auth/current-user";
import { canLogProductivityForOthers, getDayLaunchData } from "@/server/services/productivity.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { APP_TIMEZONE } from "@/lib/dates";
import { DayLaunchForm } from "./day-launch-form";

export default async function LancarDiaPage() {
  const user = await requireUser();
  if (!canLogProductivityForOthers(user)) redirect("/produtividade");
  const data = await getDayLaunchData(user);
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  return (
    <>
      <PageHeader
        title="Lançar o dia da equipe"
        description="Escolha o dia e a atividade (ex.: Reforma de paletes) e informe de uma vez o que cada pessoa fez. Cada linha vira o lançamento dela, que aparece na página dela."
      />
      <PageBody>
        <DayLaunchForm helpers={data.helpers} activities={data.activities} today={today} />
      </PageBody>
    </>
  );
}
