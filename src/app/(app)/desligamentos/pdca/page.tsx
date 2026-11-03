import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
import { HeadcountBase } from "./headcount-base";
import { WOULD_RETURN } from "@/domain/termination/interview";

const TONE: Record<GoalStatus, "success" | "warning" | "danger" | "neutral"> = { DENTRO: "success", ATENCAO: "warning", FORA: "danger", SEM_META: "neutral" };
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
const SOURCE_LABEL = { cadastro: "estimado pelo cadastro de colaboradores e pelos desligamentos importados", oficial: "informado por você (efetivo oficial de cada mês)", misto: "parte informado por você, parte estimado pelo cadastro" } as const;

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
  const lastClosedAnnual = v.rolling.length > 0 ? v.rolling.filter((r) => r.rate !== null) : [];

  const interviewsCard = (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">O que dizem as entrevistas de desligamento</p>
        <p className="text-xs text-foreground-subtle">Motivo real da saída, dito pelo colaborador (últimos 12 meses fechados). Registre cada entrevista na lista de desligamentos.</p>
      </div>
      {!v.interviews || v.interviews.count === 0 ? (
        <p className="text-sm text-foreground-subtle">Nenhuma entrevista registrada na janela.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Entrevistas" value={v.interviews.count} />
            <StatCard label="Motivo mais citado" value={v.interviews.primary[0]?.label ?? "—"} hint={v.interviews.primary[0] ? `${v.interviews.primary[0].pct}% dos entrevistados` : undefined} />
            <StatCard label="Voltariam" value={v.interviews.wouldReturnPct === null ? "—" : `${v.interviews.wouldReturnPct}%`} hint={WOULD_RETURN[0].label} />
            <StatCard
              label="Pior nota média"
              value={(() => {
                const w = v.interviews.ratings.filter((r) => r.avg !== null).sort((a, b) => (a.avg ?? 5) - (b.avg ?? 5))[0];
                return w ? `${w.label} ${w.avg}` : "—";
              })()}
              hint="de 1 a 5"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo principal</TableHead>
                  <TableHead className="text-right">Entrevistas</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.interviews.primary.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avaliação dos que saíram</TableHead>
                  <TableHead className="text-right">Nota média</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.interviews.ratings.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.avg ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground-subtle">{r.n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );

  const checkCard = (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Check — como o turnover evoluiu</CardTitle>
          <CardDescription>Turnover de cada mês fechado, olhando os 12 meses até ele. Só aparece quando o histórico importado já cobria a janela inteira.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {lastClosedAnnual.length > 0 ? (
          <SeriesBars series={{ title: "Turnover móvel de 12 meses (%)", unit: "%", highlightLast: true, points: lastClosedAnnual.map((r) => ({ label: r.label, value: r.rate ?? 0 })) }} />
        ) : (
          <p className="text-sm text-foreground-subtle">Ainda não há mês com 12 meses de histórico importado para desenhar o gráfico.</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês fechado</TableHead>
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
                  <TableCell>{r.rate === null ? <span className="text-foreground-subtle">sem histórico completo</span> : <Badge tone={TONE[g]}>{GOAL_STATUS_LABEL[g]}</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="PDCA do turnover"
        description="Planejar (onde e por que as pessoas saem), fazer (o plano de ação), verificar (o turnover contra a meta) e agir (o que vira padrão). Redução de QLP e transferência para cliente não monitorado não entram na conta."
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
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">As tabelas do PDCA ainda não existem no banco. Depois de criadas, a tela funciona.</div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Situação{v.basis.closedLabel ? ` — fechamento de ${v.basis.closedLabel}` : ""}</CardTitle>
                  <CardDescription>Turnover dos últimos 12 meses fechados: desligamentos da janela ÷ efetivo médio da janela.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {v.current ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <StatCard label="Turnover 12 meses" value={pct(v.current.rate)} hint={`${v.current.exits12} saída(s) ÷ efetivo médio ${v.current.avgHeadcount}`} />
                      {goals.map((g) => (
                        <StatCard key={g.label} label={g.label} value={pct(g.goal)} tone={TONE[g.status]} hint={GOAL_STATUS_LABEL[g.status]} />
                      ))}
                    </div>
                    {v.budget !== null && (
                      <p className={cn("rounded-md px-3 py-2 text-sm", v.budget >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                        {v.budget >= 0
                          ? `Para fechar na meta do ano (${pct(v.data.annualGoal)}), ainda cabem cerca de ${v.budget} desligamento(s) na janela de 12 meses.`
                          : `A janela de 12 meses já passou ${Math.abs(v.budget)} desligamento(s) do que a meta do ano (${pct(v.data.annualGoal)}) comporta.`}
                      </p>
                    )}
                    <p className="text-xs text-foreground-subtle">
                      Janela: {v.basis.windowLabel}. Efetivo {SOURCE_LABEL[v.basis.source]}.
                      {v.basis.unplaced > 0 ? ` ${v.basis.unplaced} colaborador(es) inativo(s) sem data de saída ficaram fora do efetivo do passado (informe a data na ficha ou importe o desligamento).` : ""}
                    </p>
                  </>
                ) : (
                  <div className="flex items-start gap-3 rounded-md bg-warning-soft px-3 py-3 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">O turnover ainda não pode ser calculado com segurança.</p>
                      <p>
                        {!v.basis.closedLabel
                          ? `Nenhum mês de ${year} fechou ainda. Veja o ano anterior ou volte depois da virada do mês.`
                          : !v.firstTermination
                            ? "Não há desligamentos importados. Importe o relatório do RH em Desligamentos e Turnover."
                            : `O histórico importado começa em ${formatDate(v.firstTermination)}, e a janela de 12 meses até ${v.basis.closedLabel} começa antes disso. Calcular assim daria um número menor que o real (os meses sem importação contam como zero saídas). Importe o histórico completo dos 12 meses.`}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <PdcaEditor year={year} initial={v.data} diagnosis={v.diagnosis} kinds={v.kinds} planExtra={interviewsCard} checkSlot={checkCard} />

            <HeadcountBase year={year} base={v.headcountBase} lastMonthIdx={year === nowYear ? Number(formatInTimeZone(new Date(), APP_TIMEZONE, "M")) - 1 : 11} />
          </>
        )}
      </PageBody>
    </>
  );
}
