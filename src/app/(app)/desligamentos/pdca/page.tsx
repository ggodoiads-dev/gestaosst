import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getPdcaView } from "@/server/services/pdca.service";
import { GOAL_STATUS_LABEL, type GoalStatus } from "@/domain/termination/pdca";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableRow } from "@/components/ui/table";
import { APP_TIMEZONE, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SeriesBars } from "../../relatorios/report-charts";
import { PdcaEditor } from "./pdca-editor";

const TONE: Record<GoalStatus, "success" | "warning" | "danger" | "neutral"> = { DENTRO: "success", ATENCAO: "warning", FORA: "danger", SEM_META: "neutral" };
const STAT_TONE: Record<GoalStatus, "success" | "warning" | "danger" | "neutral"> = TONE;
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);

export default async function PdcaTurnoverPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE)) redirect("/inicio");
  const { ano } = await searchParams;
  const nowYear = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy"));
  const year = ano && /^\d{4}$/.test(ano) && Number(ano) <= nowYear ? Number(ano) : nowYear;
  const v = await getPdcaView(user, year);
  const href = (y: number) => `/desligamentos/pdca?ano=${y}`;
  const goals = [
    { label: "Meta do mês", goal: v.data.monthlyGoal, status: v.status.monthly },
    { label: "Meta acumulada (YTD)", goal: v.data.ytdGoal, status: v.status.ytd },
    { label: "Meta do ano", goal: v.data.annualGoal, status: v.status.annual },
  ];

  return (
    <>
      <PageHeader
        title="PDCA do turnover"
        description="Plan: onde e por que as pessoas saem. Do: o que está sendo feito. Check: o turnover dos últimos 12 meses contra a meta, calculado dos desligamentos importados. Act: o que virou padrão. Redução de QLP e transferência para cliente não monitorado não entram na conta."
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/desligamentos?ano=${year}`}>Ver desligamentos</Link>
          </Button>
        }
      />
      <PageBody>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" asChild>
            <Link href={href(year - 1)} aria-label="Ano anterior">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-20 text-center text-sm font-semibold text-foreground">{year}</span>
          <Button size="icon" variant="secondary" asChild disabled={year >= nowYear}>
            <Link href={href(year + 1)} aria-label="Próximo ano" className={cn(year >= nowYear && "pointer-events-none opacity-40")}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        {!v.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
            As tabelas do PDCA ainda não existem no banco. Depois de criadas, a tela funciona.
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Check — turnover dos últimos 12 meses contra a meta</CardTitle>
                <CardDescription>
                  Desligamentos da janela de 12 meses ÷ efetivo médio da janela. As três metas são comparadas ao valor do último mês fechado
                  {v.current ? ` (${v.current.label})` : ""}.
                  {v.firstTermination ? ` O primeiro desligamento importado é de ${formatDate(v.firstTermination)}: meses anteriores a essa data ficam sem valor porque a janela de 12 meses não está completa.` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {!v.current ? (
                  <p className="text-sm text-foreground-subtle">Ainda não há 12 meses de desligamentos importados para calcular o indicador. Importe o relatório do RH com o histórico dos últimos 12 meses.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <StatCard label={`Turnover 12 meses (${v.current.label})`} value={pct(v.current.rate)} hint={`${v.current.exits12} saída(s) · efetivo médio ${v.current.avgHeadcount}`} />
                      {goals.map((g) => (
                        <StatCard key={g.label} label={g.label} value={pct(g.goal)} tone={STAT_TONE[g.status]} hint={GOAL_STATUS_LABEL[g.status]} />
                      ))}
                    </div>
                    {v.budget !== null && (
                      <p className={cn("rounded-md px-3 py-2 text-sm", v.budget >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                        {v.budget >= 0
                          ? `Para fechar na meta do ano (${pct(v.data.annualGoal)}), ainda cabem cerca de ${v.budget} desligamento(s) na janela de 12 meses.`
                          : `A janela de 12 meses já passou ${Math.abs(v.budget)} desligamento(s) do que a meta do ano (${pct(v.data.annualGoal)}) comporta.`}
                      </p>
                    )}
                  </>
                )}
                <SeriesBars series={{ title: "Turnover móvel de 12 meses (%)", unit: "%", highlightLast: true, points: v.rolling.filter((r) => r.rate !== null).map((r) => ({ label: r.label, value: r.rate ?? 0 })) }} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Saídas nos 12 meses</TableHead>
                      <TableHead className="text-right">Turnover 12 meses</TableHead>
                      <TableHead>Contra a meta do ano</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {v.rolling.map((r) => {
                      const g = r.rate === null || v.data.annualGoal === null ? "SEM_META" : r.rate <= v.data.annualGoal ? "DENTRO" : r.rate <= v.data.annualGoal * 1.1 ? "ATENCAO" : "FORA";
                      return (
                        <TableRow key={r.month}>
                          <TableCell>{r.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.exits}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{pct(r.rate)}</TableCell>
                          <TableCell>{r.rate === null ? <span className="text-foreground-subtle">sem 12 meses de dado</span> : <Badge tone={TONE[g]}>{GOAL_STATUS_LABEL[g]}</Badge>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <PdcaEditor year={year} initial={v.data} diagnosis={v.diagnosis} kinds={v.kinds} />
          </>
        )}
      </PageBody>
    </>
  );
}
