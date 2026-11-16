import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarHeart } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getBankHoursOverview } from "@/server/services/bank-hours.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HolidayCreditPanel } from "./holiday-credit-panel";
import { BalanceTable } from "./balance-table";
import { ManualEntryDialog } from "./manual-entry-dialog";

const br = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

export default async function BancoDeHorasPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  const { ano } = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(ano) >= 2024 && Number(ano) <= thisYear + 1 ? Number(ano) : thisYear;
  const overview = await getBankHoursOverview(user, year);

  const negative = overview.people.filter((p) => p.balance < 0).length;
  const positive = overview.people.filter((p) => p.balance > 0).length;
  const pendingTotal = overview.suggestions.reduce((s, x) => s + x.people.length, 0);

  return (
    <>
      <PageHeader
        title="Banco de Horas"
        description="Quem trabalha em feriado nacional ganha 1 dia de folga. A folga lançada na escala como BH- abate do saldo; sem saldo, a pessoa fica devendo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ManualEntryDialog collaborators={overview.people.map((p) => ({ id: p.collaboratorId, name: p.name }))} />
            <Button size="icon" variant="secondary" asChild>
              <Link href={`/banco-de-horas?ano=${year - 1}`} aria-label="Ano anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-14 text-center text-sm font-medium text-foreground">{year}</span>
            <Button size="icon" variant="secondary" asChild disabled={year >= thisYear}>
              <Link href={`/banco-de-horas?ano=${year + 1}`} aria-label="Próximo ano" className={year >= thisYear ? "pointer-events-none opacity-40" : undefined}>
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody className="flex flex-col gap-6">
        {!overview.tableReady && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            A atualização do banco de dados do Banco de Horas ainda não foi aplicada: dá para ver o saldo vindo da escala (BH+ e BH-), mas não dá para creditar feriado nem lançar ajuste manual por enquanto.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-foreground-subtle">Feriados a creditar</p>
            <p className={`text-2xl font-semibold tabular-nums ${pendingTotal > 0 ? "text-warning" : "text-success"}`}>{pendingTotal}</p>
            <p className="text-xs text-foreground-subtle">pessoa(s) que trabalharam e ainda não ganharam o dia</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-foreground-subtle">Com saldo</p>
            <p className="text-2xl font-semibold tabular-nums text-success">{positive}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-foreground-subtle">Devendo</p>
            <p className={`text-2xl font-semibold tabular-nums ${negative > 0 ? "text-danger" : "text-foreground"}`}>{negative}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-foreground-subtle">Colaboradores</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{overview.people.length}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarHeart className="size-4" /> Feriados nacionais de {year}
            </CardTitle>
            <CardDescription>Corpus Christi e Carnaval são ponto facultativo e não entram.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {overview.holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium tabular-nums text-foreground">{br(h.date)}</span> <span className="text-foreground-muted">{h.name}</span>
                  </span>
                  {!h.past ? (
                    <Badge tone="neutral">Ainda não chegou</Badge>
                  ) : h.pendingCount > 0 ? (
                    <Badge tone="warning">{h.pendingCount} a creditar</Badge>
                  ) : (
                    <Badge tone="success">{h.creditedCount} creditado(s)</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {overview.suggestions.length > 0 && <HolidayCreditPanel suggestions={overview.suggestions} disabled={!overview.tableReady} />}

        <BalanceTable people={overview.people} canEdit={overview.tableReady} />
      </PageBody>
    </>
  );
}
