import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMyShiftCheckInToday } from "@/server/services/shift-checkin.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/dates";
import { ConfirmCheckInButton } from "./confirm-checkin-button";

export default async function MinhaPresencaPage() {
  const user = await requireUser();
  const result = await getMyShiftCheckInToday(user);

  if (!result) {
    return (
      <>
        <PageHeader title="Minha Presença" description="Confirme que você está presente no turno de hoje." />
        <PageBody>
          <Card>
            <CardContent className="py-10 text-center text-sm text-foreground-subtle">
              Seu usuário ainda não está vinculado a um colaborador. Peça pro seu gestor vincular seu acesso.
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const { collaborator, date, status, checkedIn, checkedInAt } = result;

  return (
    <>
      <PageHeader title="Minha Presença" description="Confirme que você está presente no turno de hoje." />
      <PageBody>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-foreground-subtle">
              {collaborator.name} · {formatDate(date)}
            </p>

            {status === "FOLGA" ? (
              <>
                <CalendarCheck className="size-10 text-foreground-subtle" />
                <p className="text-base font-medium text-foreground">Hoje é seu dia de folga.</p>
                <p className="text-sm text-foreground-subtle">Não é preciso confirmar presença.</p>
              </>
            ) : checkedIn ? (
              <>
                <CheckCircle2 className="size-10 text-success" />
                <p className="text-base font-medium text-foreground">Presença confirmada.</p>
                {checkedInAt && (
                  <p className="text-sm text-foreground-subtle">Registrada às {formatTime(checkedInAt)}.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-base font-medium text-foreground">Você está escalado pra hoje.</p>
                <ConfirmCheckInButton />
              </>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
