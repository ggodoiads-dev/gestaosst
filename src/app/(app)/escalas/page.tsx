import { requireUser } from "@/server/auth/current-user";
import { getScheduleGrid, listTurnos } from "@/server/services/schedule.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScheduleGridClient } from "./schedule-grid-client";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function EscalasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;
  const now = new Date();
  const month = Number(monthParam) || now.getMonth() + 1;
  const year = Number(yearParam) || now.getFullYear();

  const user = await requireUser();
  const [{ rows }, turnos] = await Promise.all([
    getScheduleGrid(user, { month, year }),
    listTurnos(user),
  ]);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const gridRows = rows.map((row) => ({
    collaborator: {
      id: row.collaborator.id,
      name: row.collaborator.name,
      turnoId: row.collaborator.turnoId,
      functionId: row.collaborator.functionId,
    },
    functionName: row.collaborator.function?.name ?? null,
    turnoLabel: row.turno
      ? `Turno ${row.turno.name} (${row.turno.scheduleType.name})${
          row.turno.startTime && row.turno.endTime ? ` · ${row.turno.startTime}-${row.turno.endTime}` : ""
        }`
      : null,
    days: row.days.map((d) => ({
      date: localDateKey(d.date),
      day: d.date.getDate(),
      weekday: WEEKDAY_LABELS[d.date.getDay()],
      computed: d.computed,
      note: d.note,
    })),
  }));

  const functionsMap = new Map<string, string>();
  for (const row of gridRows) {
    if (row.collaborator.functionId && row.functionName) {
      functionsMap.set(row.collaborator.functionId, row.functionName);
    }
  }
  const functions = Array.from(functionsMap, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      <PageHeader
        title="Escalas de Trabalho"
        description="Grade mensal de trabalho/folga por colaborador — clique no nome pra definir o turno, ou num dia pra registrar falta, atestado ou outra observação."
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" asChild>
              <Link href={`/escalas?month=${prevMonth}&year=${prevYear}`} aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-32 text-center text-sm font-medium text-foreground">
              {MONTH_LABELS[month - 1]} de {year}
            </span>
            <Button size="icon" variant="secondary" asChild>
              <Link href={`/escalas?month=${nextMonth}&year=${nextYear}`} aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        {gridRows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-foreground-subtle">
              Nenhum colaborador ativo cadastrado ainda.
            </CardContent>
          </Card>
        ) : (
          <ScheduleGridClient rows={gridRows} turnos={turnos} functions={functions} />
        )}
      </PageBody>
    </>
  );
}
