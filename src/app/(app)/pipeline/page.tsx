import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getPipelineView } from "@/server/services/pipeline.service";
import { getMatrixView, listSpecialists } from "@/server/services/pipeline-matrix.service";
import { getMentorsView } from "@/server/services/pipeline-mentors.service";
import { POSITION_STATUS, iccLabel } from "@/domain/pipeline/rules";
import { SPECIALIST_GROUPS } from "@/domain/pipeline/matrix";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableRow } from "@/components/ui/table";
import { APP_TIMEZONE, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PositionDialog } from "./position-dialog";
import { CycleDialog, RiskFollowEditor } from "./cycle-dialog";
import { MatrixGrid } from "./matrix-grid";
import { SpecialistDialog } from "./specialist-dialog";
import { SuccessionCards, SuccessionTable, SuccessionTree, ViewSwitch, type SuccessionView } from "./succession-views";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "ciclo", label: "Ciclo de Gente" },
  { key: "sucessao", label: "Plano de sucessão" },
  { key: "mentores", label: "Mentores" },
  { key: "matriz", label: "Matriz de função" },
  { key: "especialistas", label: "Especialistas de função" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
const statusLabel = (key: string | null) => POSITION_STATUS.find((s) => s.key === key)?.label ?? null;

function Distribution({ title, rows }: { title: string; rows: { key: string; label: string; count: number; pct: number }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{title}</p>
      <Table>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right tabular-nums text-foreground-subtle">{r.count}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{pct(r.pct)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ ano?: string; aba?: string; vis?: string; m?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE)) redirect("/inicio");
  const sp = await searchParams;
  const nowYear = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy"));
  const year = sp.ano && /^\d{4}$/.test(sp.ano) && Number(sp.ano) >= 2020 && Number(sp.ano) <= nowYear + 1 ? Number(sp.ano) : nowYear;
  const tab: Tab = TABS.some((t) => t.key === sp.aba) ? (sp.aba as Tab) : "visao";
  const vis: SuccessionView = sp.vis === "arvore" || sp.vis === "tabela" ? sp.vis : "cartoes";

  const v = await getPipelineView(user, year);
  const names = v.collaboratorNames;
  const [mentorsView, matrixView, specialists] = await Promise.all([
    tab === "mentores" || tab === "visao" ? getMentorsView(user, year) : Promise.resolve(null),
    tab === "matriz" || tab === "visao" ? getMatrixView(user, sp.m) : Promise.resolve(null),
    tab === "especialistas" || tab === "visao" ? listSpecialists(user) : Promise.resolve(null),
  ]);
  const riskHigh = v.summary.risk.find((r) => r.key === "ALTO")?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Pipeline de Gente"
        description="Tempo de casa, Ciclo de Gente, plano de sucessão, matriz de função e especialistas de função, num lugar só. O tempo de casa vem do cadastro de colaboradores; o resto você lança aqui ou importa da planilha de gestão do pipeline."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/pipeline/importar">Importar planilha</Link>
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <Link key={t.key} href={`/pipeline?aba=${t.key}&ano=${year}`} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === t.key ? "border-accent text-foreground" : "border-transparent text-foreground-subtle hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Visão geral ── */}
        {tab === "visao" && (
          <>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Tempo médio de casa</CardTitle>
                  <CardDescription>Colaboradores ativos com data de admissão: {v.tenure.total}.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label="Média (meses)" value={v.tenure.averageMonths === null ? "—" : String(v.tenure.averageMonths).replace(".", ",")} />
                {v.tenure.bands.map((b) => (
                  <StatCard key={b.key} label={b.label} value={b.count} hint={pct(b.pct)} />
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Cargos no plano de sucessão" value={v.positions.length} hint={riskHigh > 0 ? `${riskHigh} com risco alto` : "nenhum com risco alto"} tone={riskHigh > 0 ? "danger" : "neutral"} href="/pipeline?aba=sucessao" />
              <StatCard label={`Risco de turnover (ciclo ${year})`} value={v.cycle.risk.length} hint={v.cycle.entries.length === 0 ? "sem ciclo lançado" : `de ${v.cycle.entries.length} avaliados`} tone={v.cycle.risk.length > 0 ? "warning" : "neutral"} href="/pipeline?aba=ciclo" />
              <StatCard label="Mentores (padrinhos)" value={mentorsView?.mentors.length ?? 0} hint={mentorsView ? `${mentorsView.mentors.filter((m) => m.flags.length === 0).length} aptos` : undefined} href="/pipeline?aba=mentores" />
              <StatCard label="Matrizes de função" value={matrixView?.matrices.length ?? 0} hint={matrixView?.current ? `${matrixView.current.name}: ${matrixView.current.stats.average === null ? "sem avaliação" : `${Math.round(matrixView.current.stats.average * 100)}% de aderência`}` : undefined} href="/pipeline?aba=matriz" />
              <StatCard label="Especialistas de função" value={specialists?.rows.length ?? 0} hint={specialists && specialists.rows.length > 0 ? `${specialists.rows.filter((r) => r.status === "CONCLUIDO").length} ação(ões) concluída(s)` : undefined} href="/pipeline?aba=especialistas" />
            </div>

            {!v.ready && <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-sm text-foreground-subtle">As tabelas do Pipeline ainda não existem no banco.</div>}
          </>
        )}

        {/* ── Ciclo de Gente + risco de turnover ── */}
        {tab === "ciclo" &&
          (!v.ready ? (
            <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">As tabelas do Pipeline ainda não existem no banco.</div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Ciclo de Gente {year}</CardTitle>
                      <CardDescription>Colaboradores por faixa do resultado de cultura e comportamento (ICC).</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex gap-1">
                        {v.years.map((y) => (
                          <Link key={y} href={`/pipeline?aba=ciclo&ano=${y}`} className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", y === year ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-foreground-subtle hover:bg-surface-muted")}>
                            {y}
                          </Link>
                        ))}
                      </div>
                      <CycleDialog year={year} names={names} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {v.cycle.entries.length === 0 ? (
                    <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">Não tivemos Ciclo de Gente em {year} (nenhum resultado lançado). Lance os resultados ou importe a planilha.</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Resultado (ICC)</TableHead>
                            <TableHead className="text-right">Colaboradores na faixa</TableHead>
                            <TableHead className="text-right">Percentual</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {v.cycle.bands.map((b) => (
                            <TableRow key={b.key}>
                              <TableCell>{b.label}</TableCell>
                              <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{pct(b.pct)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="font-semibold">Total</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{v.cycle.entries.length}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      <details className="rounded-md border border-border p-3">
                        <summary className="cursor-pointer select-none text-sm font-medium text-foreground-muted">Resultados por colaborador ({v.cycle.entries.length})</summary>
                        <div className="mt-3 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Líder</TableHead>
                                <TableHead className="text-right">ICC</TableHead>
                                <TableHead>Resultado ICC</TableHead>
                                <TableHead className="text-right">IR</TableHead>
                                <TableHead>Resultado IR</TableHead>
                                <TableHead>AVD</TableHead>
                                <TableHead>Classificação final</TableHead>
                                <TableHead className="w-12" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {v.cycle.entries.map((e) => (
                                <TableRow key={e.id}>
                                  <TableCell className="font-medium">{e.name}</TableCell>
                                  <TableCell className="text-foreground-subtle">{e.leader ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{e.icc ?? "—"}</TableCell>
                                  <TableCell>{iccLabel(e.iccResult)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{e.ir ?? "—"}</TableCell>
                                  <TableCell className="text-foreground-subtle">{e.irResult ?? "—"}</TableCell>
                                  <TableCell className="text-foreground-subtle">{e.perfEval ?? "—"}</TableCell>
                                  <TableCell className="text-foreground-subtle">{e.finalClass ?? "—"}</TableCell>
                                  <TableCell>
                                    <CycleDialog year={year} entry={e} names={names} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </details>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Risco de turnover — Ciclo de Gente {year}</CardTitle>
                    <CardDescription>Quem teve resultado de cultura negativo ou muito negativo. Registre a situação atual e o follow combinado com a pessoa e o líder.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {v.cycle.risk.length === 0 ? (
                    <p className="text-sm text-foreground-subtle">Ninguém na faixa de risco neste ciclo.</p>
                  ) : (
                    v.cycle.risk.map((e) => (
                      <div key={e.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-sm font-semibold text-foreground">{e.name}</p>
                          <Badge tone={e.iccResult === "MUITO_NEGATIVA" ? "danger" : "warning"}>{iccLabel(e.iccResult)}</Badge>
                          <span className="text-xs text-foreground-subtle">
                            Líder: {e.leader ?? "—"} · ICC {e.icc ?? "—"} · IR {e.ir ?? "—"} · AVD {e.perfEval ?? "—"} · {e.finalClass ?? "sem classificação final"}
                          </span>
                        </div>
                        <RiskFollowEditor entry={e} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ))}

        {/* ── Plano de sucessão ── */}
        {tab === "sucessao" &&
          (!v.ready ? (
            <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">As tabelas do Pipeline ainda não existem no banco.</div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <CardTitle>Plano de sucessão</CardTitle>
                    <CardDescription>Cargos críticos, quem ocupa, quem pode suceder e em quanto tempo. O risco da posição é calculado: cargo de criticidade alta só fica baixo com sucessor pronto agora, e médio com sucessor em até 6 meses.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ViewSwitch current={vis} year={year} />
                    <PositionDialog names={names} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {v.positions.length === 0 ? (
                  <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">Nenhum cargo no plano ainda. Cadastre um cargo ou importe a planilha de gestão do pipeline.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {v.summary.risk.map((r) => (
                        <StatCard key={r.key} label={`Risco ${r.label.toLowerCase()}`} value={r.count} hint={pct(r.pct)} tone={r.key === "ALTO" ? "danger" : r.key === "MEDIO" ? "warning" : "success"} />
                      ))}
                      <StatCard label="Cargos no plano" value={v.summary.total} />
                    </div>
                    {vis === "cartoes" && <SuccessionCards positions={v.positions} names={names} />}
                    {vis === "arvore" && <SuccessionTree positions={v.positions} />}
                    {vis === "tabela" && <SuccessionTable positions={v.positions} names={names} />}
                    <details className="rounded-md border border-border p-3">
                      <summary className="cursor-pointer select-none text-sm font-medium text-foreground-muted">Resumo do plano de sucessão</summary>
                      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Distribution title="Criticidade" rows={v.summary.criticality} />
                        <Distribution title="Potencial dos sucessores" rows={v.summary.potential} />
                        <Distribution title="Risco da posição" rows={v.summary.risk} />
                        <Distribution title="Prontidão do sucessor" rows={v.summary.readiness} />
                      </div>
                      <p className="mt-2 text-xs text-foreground-subtle">Percentuais sobre os {v.summary.total} cargos do plano.</p>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          ))}

        {/* ── Mentores (padrinhos) ── */}
        {tab === "mentores" && mentorsView && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <CardTitle>Mentores (padrinhos)</CardTitle>
                  <CardDescription>
                    Quem fez a Trilha de Treinamento para Padrinhos (cadastro de qualificações), com o que a planilha de gestão pede: tempo de casa, Ciclo de Gente, ocorrência de segurança e falta nos últimos 12 meses. A aderência na matriz e o plano de desenvolvimento vêm das outras abas.
                  </CardDescription>
                </div>
                <Button variant="secondary" asChild>
                  <Link href="/pipeline?aba=especialistas">Plano de desenvolvimento</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Padrinhos com a trilha" value={mentorsView.mentors.length} />
                <StatCard label="Sem ponto de atenção" value={mentorsView.mentors.filter((m) => m.flags.length === 0).length} tone="success" hint="sem ocorrência de segurança nem falta em 12 meses" />
                <StatCard label="Com ponto de atenção" value={mentorsView.mentors.filter((m) => m.flags.length > 0).length} tone={mentorsView.mentors.some((m) => m.flags.length > 0) ? "warning" : "neutral"} />
                <StatCard label="Indicados sem a trilha" value={mentorsView.withoutCertificate.length} tone={mentorsView.withoutCertificate.length > 0 ? "warning" : "neutral"} hint="marcados como Padrinho no Pipeline" />
              </div>

              {mentorsView.mentors.length === 0 ? (
                <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">Nenhum colaborador ativo com a Trilha de Treinamento para Padrinhos cadastrada. Cadastre a qualificação &quot;Padrinho&quot; na ficha de cada um em Qualificações.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Padrinho</TableHead>
                        <TableHead>Certificado</TableHead>
                        <TableHead>Apto a apadrinhar</TableHead>
                        <TableHead>Admissão</TableHead>
                        <TableHead className="text-right">Tempo de casa</TableHead>
                        <TableHead>Ciclo de Gente {year}</TableHead>
                        <TableHead>Ocorrência de segurança?</TableHead>
                        <TableHead>Falta?</TableHead>
                        <TableHead>Matriz</TableHead>
                        <TableHead>Desenvolvimento</TableHead>
                        <TableHead>Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mentorsView.mentors.map((m) => (
                        <TableRow key={m.collaboratorId}>
                          <TableCell className="font-medium">
                            <Link href={`/colaboradores/${m.collaboratorId}`} className="hover:underline">
                              {m.name}
                            </Link>
                            <p className="text-xs font-normal text-foreground-subtle">{m.functionName ?? "—"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge tone="success">Trilha concluída</Badge>
                            <p className="text-[11px] text-foreground-subtle">{formatDate(m.certifiedAt)}</p>
                          </TableCell>
                          <TableCell className="text-foreground-subtle">{m.functionName ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-foreground-subtle">{m.admissionDate ? formatDate(m.admissionDate) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.tenureMonths === null ? "—" : `${m.tenureMonths} meses`}</TableCell>
                          <TableCell className="text-foreground-subtle">{m.cycle ?? "—"}</TableCell>
                          <TableCell>{m.safetyOccurrences > 0 ? <Badge tone="danger">Sim ({m.safetyOccurrences})</Badge> : <span className="text-foreground-subtle">Não</span>}</TableCell>
                          <TableCell>{m.absences > 0 ? <Badge tone="warning">Sim ({m.absences})</Badge> : <span className="text-foreground-subtle">Não</span>}</TableCell>
                          <TableCell className="whitespace-nowrap">{m.matrix ? `${m.matrix.pct}% · ${m.matrix.level}` : <span className="text-foreground-subtle">—</span>}</TableCell>
                          <TableCell className="max-w-56 text-xs text-foreground-muted">
                            {m.plan ? (
                              <>
                                {[m.plan.skill, m.plan.action].filter(Boolean).join(": ") || "Plano cadastrado"}
                                <span className="block text-foreground-subtle">{[statusLabel(m.plan.status), m.plan.dueDate ? formatDate(m.plan.dueDate) : m.plan.dueNote].filter(Boolean).join(" · ")}</span>
                              </>
                            ) : (
                              <span className="text-foreground-subtle">—</span>
                            )}
                          </TableCell>
                          <TableCell>{m.flags.length === 0 ? <Badge tone="success">Apto</Badge> : <Badge tone="warning">Atenção</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-foreground-subtle">Ocorrência de segurança: acidente em que a pessoa foi vítima, nos últimos 12 meses (cancelados não contam). Falta: falta lançada na escala nos últimos 12 meses (atestado não conta). &quot;Apto a apadrinhar&quot; é a função dele: um padrinho acompanha novatos da mesma função.</p>

              {mentorsView.withoutCertificate.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning-soft/40 p-3">
                  <p className="text-sm font-semibold text-foreground">Indicados como Padrinho no Pipeline, mas sem a trilha cadastrada</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-foreground-muted">
                    {mentorsView.withoutCertificate.map((w) => (
                      <li key={w.name}>
                        {w.name} <span className="text-foreground-subtle">({w.where})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-foreground-subtle">Para defender, cadastre a qualificação &quot;Padrinho&quot; (com o certificado) na ficha deles, ou tire do grupo Padrinho.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Matriz de função ── */}
        {tab === "matriz" && matrixView && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Matriz de função (multiskill)</CardTitle>
                <CardDescription>Quanto cada pessoa domina de cada atividade da função. Clique numa célula para escolher o nível; a aderência (atividades que executa sozinho ou ensina) e o nível se recalculam na hora.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!matrixView.ready ? (
                <p className="text-sm text-foreground-subtle">As tabelas da Matriz ainda não existem no banco.</p>
              ) : (
                <MatrixGrid key={matrixView.current?.id ?? "vazio"} matrix={matrixView.current} matrices={matrixView.matrices} collaborators={matrixView.collaborators} />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Especialistas de função ── */}
        {tab === "especialistas" && specialists && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <CardTitle>Especialistas de função — plano de desenvolvimento</CardTitle>
                  <CardDescription>Quem é referência na função (operador educador, campeão de segurança, motorista educador, padrinho, líder operacional), a habilidade a desenvolver e a ação combinada.</CardDescription>
                </div>
                <SpecialistDialog people={v.people} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {!specialists.ready ? (
                <p className="text-sm text-foreground-subtle">As tabelas dos Especialistas ainda não existem no banco.</p>
              ) : (
                [...new Set([...SPECIALIST_GROUPS, ...specialists.rows.map((r) => r.grp)])].map((group) => {
                  const rows = specialists.rows.filter((r) => r.grp === group);
                  return (
                    <div key={group} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {group} <span className="text-xs font-normal text-foreground-subtle">({rows.length})</span>
                        </p>
                        <SpecialistDialog people={v.people} defaultGroup={group} />
                      </div>
                      {rows.length === 0 ? (
                        <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-foreground-subtle">Ninguém neste grupo ainda.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {rows.map((r) => (
                            <div key={r.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{r.name}</p>
                                  <p className="text-xs text-foreground-subtle">{r.functionName ?? "—"}</p>
                                </div>
                                {statusLabel(r.status) && <Badge tone={r.status === "CONCLUIDO" ? "success" : r.status === "ANDAMENTO" ? "info" : "neutral"}>{statusLabel(r.status)}</Badge>}
                              </div>
                              {r.skill && (
                                <p className="text-xs text-foreground-muted">
                                  <span className="font-semibold text-foreground">Habilidade:</span> {r.skill}
                                </p>
                              )}
                              {r.action && (
                                <p className="text-xs text-foreground-muted">
                                  <span className="font-semibold text-foreground">Ação:</span> {r.action}
                                </p>
                              )}
                              {r.follow && (
                                <p className="text-xs text-foreground-muted">
                                  <span className="font-semibold text-foreground">Follow:</span> {r.follow}
                                </p>
                              )}
                              <div className="mt-auto flex items-center justify-between pt-1">
                                <span className="text-[11px] text-foreground-subtle">{r.dueDate ? `Prazo ${formatDate(r.dueDate)}` : (r.dueNote ?? "")}</span>
                                <SpecialistDialog row={r} people={v.people} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
