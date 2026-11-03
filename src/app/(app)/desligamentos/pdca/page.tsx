import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getPdcaView } from "@/server/services/pdca.service";
import { GOAL_STATUS_LABEL, goalStatus, type GoalStatus } from "@/domain/termination/pdca";
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
import { canViewCascade, getCascadeTree, type CascadeTreeNode } from "@/server/services/cascade.service";
import { TURNOVER_IC_SEED_KEY } from "@/domain/termination/turnover-cascade";
import { CascadeTree } from "../../cascata/cascade-tree";
import { SyncSeedButton } from "../../cascata/cascade-dialogs";
import { MotivosTable, SatisfacaoTable } from "../entrevistas/resumo/survey-tables";

const TONE: Record<GoalStatus, "success" | "warning" | "danger" | "neutral"> = { DENTRO: "success", ATENCAO: "warning", FORA: "danger", SEM_META: "neutral" };
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
const SOURCE_LABEL = { cadastro: "estimado pelo cadastro de colaboradores (informe o QLP de cada mês, no fim da página, para bater com o BI)", oficial: "informado por você (QLP de cada mês)", misto: "parte informado por você, parte estimado pelo cadastro (informe os meses que faltam, no fim da página)" } as const;

export default async function PdcaTurnoverPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE)) redirect("/inicio");
  const { ano } = await searchParams;
  const nowYear = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy"));
  const year = ano && /^\d{4}$/.test(ano) && Number(ano) <= nowYear ? Number(ano) : nowYear;
  const v = await getPdcaView(user, year);
  // A cascata do turnover é o IC "TO geral" do Cascateamento com os IVs que o explicam: aqui aparece só essa parte, no último mês fechado do ano.
  const cascadePeriod = v.closedMonthKey ?? `${year - 1}-12`;
  const cascadeAllowed = canViewCascade(user);
  const cascadeData = cascadeAllowed && v.ready ? await getCascadeTree(user, cascadePeriod, { subtreeOf: TURNOVER_IC_SEED_KEY }) : null;
  const toNode: CascadeTreeNode | null = cascadeData?.roots.find((n) => n.seedKey === TURNOVER_IC_SEED_KEY) ?? null;
  const ivOptions: { id: string; label: string }[] = [];
  const collect = (node: CascadeTreeNode, path: string[]) => {
    for (const c of node.children) {
      const next = [...path, c.name];
      ivOptions.push({ id: c.id, label: next.join(" › ") });
      collect(c, next);
    }
  };
  if (toNode) collect(toNode, []);
  const href = (y: number) => `/desligamentos/pdca?ano=${y}`;
  const goals = [
    { label: "Meta do mês", goal: v.data.monthlyGoal, status: v.status.monthly },
    { label: "Meta acumulada (YTD)", goal: v.data.ytdGoal, status: v.status.ytd },
    { label: "Meta do ano", goal: v.data.annualGoal, status: v.status.annual },
  ];
  const cascadeCard = (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Cascata do turnover — do número à causa raiz</p>
          <p className="text-xs text-foreground-subtle">
            Mesmo modelo do Cascateamento de metas: o IC é o <strong className="text-foreground">TO geral</strong> e os IVs mostram como e por que ele está nesse número. Os IVs com <span className="whitespace-nowrap">⚡</span> são calculados pelo SIGO até {v.basis.closedLabel ?? "hoje"} (as saídas do ano).
          </p>
        </div>
        {cascadeAllowed && (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/cascata?periodo=${cascadePeriod}`}>Abrir no Cascateamento</Link>
          </Button>
        )}
      </div>
      {!cascadeAllowed ? (
        <p className="text-sm text-foreground-subtle">Você não tem acesso ao Cascateamento de metas, onde fica a cascata do turnover. Peça a quem gerencia.</p>
      ) : !cascadeData || !cascadeData.ready ? (
        <p className="text-sm text-foreground-subtle">O Cascateamento de metas ainda não foi ativado no banco de dados.</p>
      ) : !toNode || toNode.children.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-md bg-surface-muted p-3 text-sm text-foreground-muted">
          <p>{toNode ? "O IC TO geral ainda não tem IVs." : "O IC TO geral ainda não existe no Cascateamento."} Clique para montar a estrutura do turnover: pedidos de demissão e motivos, saídas até 90 dias, entrevistas, satisfação e saídas por turno, área e cargo.</p>
          {cascadeData.canManage ? <SyncSeedButton /> : <p className="text-xs text-foreground-subtle">Peça a quem gerencia o Cascateamento para completar a estrutura.</p>}
        </div>
      ) : (
        <CascadeTree roots={[toNode]} periodKey={cascadePeriod} canManage={cascadeData.canManage} owners={cascadeData.owners} focus />
      )}
    </div>
  );

  const closedMonths = v.months.filter((r) => r.rate !== null);

  const interviewsCard = (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">O que dizem as entrevistas de desligamento</p>
        <p className="text-xs text-foreground-subtle">Motivo real da saída, dito pelo colaborador (saídas do ano). Registre cada entrevista na lista de desligamentos ou suba o resumo da plataforma de entrevistas.</p>
      </div>
      {!v.interviews || v.interviews.count === 0 ? (
        <p className="text-sm text-foreground-subtle">Nenhuma entrevista registrada neste ano.</p>
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
      {(v.survey.motivos || v.survey.satisfacao) && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground">Resumo da plataforma de entrevistas</p>
          {v.survey.motivos && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-foreground-subtle">Motivos da saída por tempo de casa{v.survey.motivos.periodLabel ? ` (${v.survey.motivos.periodLabel})` : ""}. Tabela somada, sem identificar pessoas.</p>
              <MotivosTable data={v.survey.motivos.data} />
            </div>
          )}
          {v.survey.satisfacao && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-foreground-subtle">Satisfação por categoria entre os que saíram{v.survey.satisfacao.periodLabel ? ` (${v.survey.satisfacao.periodLabel})` : ""}.</p>
              <SatisfacaoTable data={v.survey.satisfacao.data} />
            </div>
          )}
        </div>
      )}
      <Link href="/desligamentos/entrevistas/resumo" className="text-xs text-accent underline-offset-2 hover:underline">
        {v.survey.motivos || v.survey.satisfacao ? "Atualizar o resumo da plataforma" : "Importar o resumo da plataforma de entrevistas (tabelas somadas)"}
      </Link>
    </div>
  );

  const checkCard = (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Check — como o turnover evoluiu</CardTitle>
          <CardDescription>Mesma conta do BI: turnover do mês = demissões do mês ÷ QLP do mês; acumulado = demissões do ano ÷ QLP médio do ano. O mês corrente conta até hoje.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {closedMonths.length > 0 ? (
          <SeriesBars series={{ title: "Turnover do mês (%)", unit: "%", highlightLast: true, points: closedMonths.map((r) => ({ label: r.label, value: r.rate ?? 0 })) }} />
        ) : (
          <p className="text-sm text-foreground-subtle">Ainda não há mês com QLP para desenhar o gráfico.</p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Demissões</TableHead>
              <TableHead className="text-right">QLP</TableHead>
              <TableHead className="text-right">Turnover do mês</TableHead>
              <TableHead>Contra a meta do mês</TableHead>
              <TableHead className="text-right">Acumulado (YTD)</TableHead>
              <TableHead>Contra a meta YTD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.months.map((r) => {
              const gm = goalStatus(r.rate, v.data.monthlyGoal);
              const gy = goalStatus(r.ytdRate, v.data.ytdGoal);
              return (
                <TableRow key={r.month}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.exits}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {String(Math.round(r.qlp * 100) / 100).replace(".", ",")}
                    {r.qlpSource === "cadastro" && (
                      <span className="ml-1 text-[11px] text-foreground-subtle" title="Estimado pelo cadastro: informe o QLP oficial no fim da página">
                        est.
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{pct(r.rate)}</TableCell>
                  <TableCell>{r.rate === null ? <span className="text-foreground-subtle">sem QLP</span> : <Badge tone={TONE[gm]}>{GOAL_STATUS_LABEL[gm]}</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{pct(r.ytdRate)}</TableCell>
                  <TableCell>{r.ytdRate === null ? <span className="text-foreground-subtle">sem QLP</span> : <Badge tone={TONE[gy]}>{GOAL_STATUS_LABEL[gy]}</Badge>}</TableCell>
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
        description="Planejar (onde e por que as pessoas saem), fazer (o plano de ação), verificar (o turnover contra a meta, na mesma conta do BI: demissões ÷ QLP) e agir (o que vira padrão). Redução de QLP e transferência para cliente não monitorado não entram nas demissões."
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
                  <CardDescription>Conta do BI: demissões ÷ QLP. No mês, as demissões do mês ÷ o QLP do mês; no ano, as demissões acumuladas ÷ o QLP médio do ano.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {v.current ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                      <StatCard label="Turnover do ano (YTD)" value={pct(v.current.ytdRate)} hint={`${v.current.ytdExits} demissão(ões) ÷ QLP ${String(Math.round(v.current.ytdQlp * 100) / 100).replace(".", ",")}`} />
                      <StatCard label="Turnover do mês" value={pct(v.current.rate)} hint={`${v.current.monthExits} demissão(ões) ÷ QLP ${String(Math.round(v.current.monthQlp * 100) / 100).replace(".", ",")}`} />
                      {goals.map((g) => (
                        <StatCard key={g.label} label={g.label} value={pct(g.goal)} tone={TONE[g.status]} hint={GOAL_STATUS_LABEL[g.status]} />
                      ))}
                    </div>
                    {v.budget !== null && (
                      <p className={cn("rounded-md px-3 py-2 text-sm", v.budget >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                        {v.budget >= 0
                          ? `Para fechar na meta do ano (${pct(v.data.annualGoal)}), ainda cabem cerca de ${v.budget} demissão(ões) até aqui.`
                          : `O ano já passou ${Math.abs(v.budget)} demissão(ões) do que a meta do ano (${pct(v.data.annualGoal)}) comporta.`}
                      </p>
                    )}
                    {v.basis.historyStartsLate && (
                      <div className="flex items-start gap-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <p>
                          {v.firstTermination
                            ? `O primeiro desligamento importado é de ${formatDate(v.firstTermination)}. Se houve saídas em ${year} antes disso, o turnover está menor que o real: importe o histórico do ano inteiro.`
                            : "Não há desligamentos importados."}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-foreground-subtle">
                      Período: {v.basis.windowLabel}. QLP {SOURCE_LABEL[v.basis.source]}.
                      {v.basis.unplaced > 0 ? ` ${v.basis.unplaced} colaborador(es) inativo(s) sem data de saída ficaram fora do efetivo do passado (informe a data na ficha ou importe o desligamento).` : ""}
                    </p>
                  </>
                ) : (
                  <div className="flex items-start gap-3 rounded-md bg-warning-soft px-3 py-3 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">O turnover ainda não pode ser calculado.</p>
                      <p>{`O ano de ${year} ainda não começou. Veja o ano anterior.`}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <PdcaEditor year={year} initial={v.data} diagnosis={v.diagnosis} kinds={v.kinds} ivOptions={ivOptions} planExtra={interviewsCard} cascadeSlot={cascadeCard} checkSlot={checkCard} />

            <HeadcountBase year={year} base={v.headcountBase} lastMonthIdx={year === nowYear ? Number(formatInTimeZone(new Date(), APP_TIMEZONE, "M")) - 1 : 11} />
          </>
        )}
      </PageBody>
    </>
  );
}
