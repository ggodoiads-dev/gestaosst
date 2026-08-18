import Link from "next/link";
import { addMonths } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMySchedule } from "@/server/services/schedule.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildHref(ref: Date) {
  return `/minha-escala?month=${ref.getMonth() + 1}&year=${ref.getFullYear()}`;
}

export default async function MinhaEscalaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;
  const now = new Date();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const refDate = new Date(year, month - 1, 1);
  const prevRef = addMonths(refDate, -1);
  const nextRef = addMonths(refDate, 1);

  const user = await requireUser();
  const schedule = await getMySchedule(user, { month, year });

  if (!schedule) {
    return (
      <>
        <PageHeader title="Minha Escala" description="Seus dias de trabalho e folga do mês." />
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

  return (
    <>
      <PageHeader
        title="Minha Escala"
        description="Seus dias de trabalho e folga do mês."
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" asChild>
              <Link href={buildHref(prevRef)} aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-foreground">
              {MONTH_LABELS[refDate.getMonth()]} de {refDate.getFullYear()}
            </span>
            <Button size="icon" variant="secondary" asChild>
              <Link href={buildHref(nextRef)} aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                {schedule.turno ? schedule.turno.scheduleType.name : "Sem turno cadastrado"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!schedule.turno && (
              <p className="text-sm text-foreground-subtle">
                Você ainda não tem um turno de escala configurado. Peça pro seu gestor cadastrar.
              </p>
            )}
            {schedule.days.map((day) => (
              <div
                key={day.date.toISOString()}
                className="flex items-center justify-between gap-2.5 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {WEEKDAY_LABELS[day.date.getDay()]}, {formatDate(day.date)}
                </span>
                <div className="flex items-center gap-2">
                  {day.note?.notes && <span className="text-xs text-foreground-subtle">{day.note.notes}</span>}
                  <Badge
                    tone={day.computed === "TRABALHO" ? "accent" : "neutral"}
                    className={day.computed === "FOLGA" ? "bg-brand text-brand-foreground" : undefined}
                  >
                    {day.computed === "TRABALHO" ? "Trabalho" : "Folga"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
