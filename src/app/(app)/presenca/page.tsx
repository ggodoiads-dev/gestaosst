import Link from "next/link";
import { ChevronLeft, ChevronRight, UserX } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getAbsenceOverview } from "@/server/services/attendance-view.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentMonthKey, isValidMonthKey, monthLabel, shiftMonth } from "@/lib/month";

const STATUS_LABEL = { FALTA: "Falta", ATESTADO: "Atestado" } as const;

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export default async function PresencaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser();
  const { mes } = await searchParams;
  const nowMonth = currentMonthKey();
  const month = isValidMonthKey(mes) && mes <= nowMonth ? mes : nowMonth;
  const isCurrentMonth = month === nowMonth;
  const overview = await getAbsenceOverview(user, month);

  const maxPerDay = Math.max(1, ...overview.perDay.map((d) => d.count));

  return (
    <>
      <PageHeader
        title="Presença e Faltas"
        description="Quem faltou ou apresentou atestado, por dia e por mês — só visualização."
      />
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/presenca?mes=${shiftMonth(month, -1)}`}>
              <ChevronLeft className="size-4" /> Anterior
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{monthLabel(month)}</p>
            {!isCurrentMonth && (
              <Link href="/presenca" className="text-xs text-accent hover:underline">Voltar para o mês atual</Link>
            )}
          </div>
          {isCurrentMonth ? (
            <Button variant="secondary" size="sm" disabled>
              Próximo <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={shiftMonth(month, 1) === nowMonth ? "/presenca" : `/presenca?mes=${shiftMonth(month, 1)}`}>
                Próximo <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-foreground-subtle">Faltas</p>
                <p className={`text-2xl font-semibold tabular-nums ${overview.faltas > 0 ? "text-danger" : "text-success"}`}>{overview.faltas}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Atestados</p>
                <p className={`text-2xl font-semibold tabular-nums ${overview.atestados > 0 ? "text-warning" : "text-success"}`}>{overview.atestados}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Pessoas com ausência</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">{overview.people}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {overview.perDay.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ausências por dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-28 items-end gap-1">
                {overview.perDay.map((d) => (
                  <div key={d.date} className="flex h-full min-w-2 flex-1 flex-col justify-end" title={`${dayLabel(d.date)}: ${d.count} ausência(s)`}>
                    <div className="rounded-t bg-danger" style={{ height: `${Math.max(8, (d.count / maxPerDay) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-foreground-subtle">
                <span>{dayLabel(overview.perDay[0].date).slice(0, 5)}</span>
                <span>pico: {maxPerDay} no dia</span>
                <span>{dayLabel(overview.perDay[overview.perDay.length - 1].date).slice(0, 5)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><UserX className="size-4" /> Mais ausências no mês</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {overview.ranking.length === 0 && <p className="text-sm text-foreground-subtle">Nenhuma ausência registrada neste mês.</p>}
              {overview.ranking.map((r) => (
                <div key={r.collaboratorId} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="truncate">{r.name}</span>
                  <span className="flex shrink-0 gap-1.5">
                    {r.faltas > 0 && <Badge tone="danger">{r.faltas} falta(s)</Badge>}
                    {r.atestados > 0 && <Badge tone="warning">{r.atestados} atestado(s)</Badge>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico mensal</CardTitle>
              <CardDescription>Cada mês fica guardado. Clique para abrir.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Faltas</TableHead>
                    <TableHead>Atestados</TableHead>
                    <TableHead>Pessoas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.history.map((h) => (
                    <TableRow key={h.month}>
                      <TableCell>
                        <Link href={h.month === nowMonth ? "/presenca" : `/presenca?mes=${h.month}`} className={h.month === month ? "font-semibold text-foreground" : "text-accent hover:underline"}>
                          {monthLabel(h.month)}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">{h.faltas}</TableCell>
                      <TableCell className="tabular-nums text-foreground-subtle">{h.atestados}</TableCell>
                      <TableCell className="tabular-nums text-foreground-subtle">{h.people}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quem faltou em {monthLabel(month)} ({overview.entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.entries.length === 0 && <TableEmpty colSpan={5} />}
                {overview.entries.map((e) => (
                  <TableRow key={`${e.date}-${e.collaboratorId}`}>
                    <TableCell className="tabular-nums">{dayLabel(e.date)}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{e.area ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{e.turno ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={e.status === "FALTA" ? "danger" : "warning"}>{STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
