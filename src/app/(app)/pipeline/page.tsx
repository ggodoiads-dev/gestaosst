import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getPipelineView } from "@/server/services/pipeline.service";
import { CRITICALITY, ORIGIN, POSITION_STATUS, POTENTIAL, READINESS, RISK_LABEL, iccLabel, type PositionRisk } from "@/domain/pipeline/rules";
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

const RISK_TONE: Record<PositionRisk, "danger" | "warning" | "success"> = { ALTO: "danger", MEDIO: "warning", BAIXO: "success" };
const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
const label = (list: readonly { key: string; label: string }[], key: string | null) => list.find((i) => i.key === key)?.label ?? "—";

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

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE)) redirect("/inicio");
  const { ano } = await searchParams;
  const nowYear = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy"));
  const year = ano && /^\d{4}$/.test(ano) && Number(ano) >= 2020 && Number(ano) <= nowYear + 1 ? Number(ano) : nowYear;
  const v = await getPipelineView(user, year);
  const names = v.collaboratorNames;

  return (
    <>
      <PageHeader
        title="Pipeline de Gente"
        description="Tempo de casa, resultado do Ciclo de Gente, risco de turnover e plano de sucessão dos cargos críticos. O tempo de casa vem do cadastro de colaboradores; o resto você lança aqui ou importa da planilha de gestão do pipeline."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/pipeline/importar">Importar planilha</Link>
          </Button>
        }
      />
      <PageBody>
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

        {!v.ready ? (
          <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">As tabelas do Pipeline ainda não existem no banco. Depois de criadas, a tela funciona.</div>
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
                        <Link key={y} href={`/pipeline?ano=${y}`} className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", y === year ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-foreground-subtle hover:bg-surface-muted")}>
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

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Plano de sucessão</CardTitle>
                    <CardDescription>
                      Cargos críticos, quem ocupa, quem pode suceder e em quanto tempo. O risco da posição é calculado: cargo de criticidade alta só fica baixo com sucessor pronto agora, e médio com sucessor em até 6 meses.
                    </CardDescription>
                  </div>
                  <PositionDialog names={names} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {v.positions.length === 0 ? (
                  <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">Nenhum cargo no plano ainda. Cadastre um cargo ou importe a planilha de gestão do pipeline.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Criticidade</TableHead>
                          <TableHead>Ocupante atual</TableHead>
                          <TableHead>Sucessor 1ª</TableHead>
                          <TableHead>Sucessor 2ª</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Prontidão</TableHead>
                          <TableHead>Potencial</TableHead>
                          <TableHead>Gap</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>Prazo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Risco da posição</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {v.positions.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.cargo}</TableCell>
                            <TableCell className="text-foreground-subtle">{p.area ?? "—"}</TableCell>
                            <TableCell>{label(CRITICALITY, p.criticality)}</TableCell>
                            <TableCell>{p.occupant ?? "—"}</TableCell>
                            <TableCell>{p.successor1 ?? "—"}</TableCell>
                            <TableCell>{p.successor2 ?? "—"}</TableCell>
                            <TableCell className="text-foreground-subtle">{label(ORIGIN, p.origin)}</TableCell>
                            <TableCell>{label(READINESS, p.readiness)}</TableCell>
                            <TableCell>{label(POTENTIAL, p.potential)}</TableCell>
                            <TableCell className="text-foreground-subtle">{p.gap ?? "—"}</TableCell>
                            <TableCell className="max-w-64 text-foreground-subtle">{p.action ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-foreground-subtle">{p.dueDate ? formatDate(p.dueDate) : (p.dueNote ?? "—")}</TableCell>
                            <TableCell className="text-foreground-subtle">{label(POSITION_STATUS, p.status)}</TableCell>
                            <TableCell>
                              <Badge tone={RISK_TONE[p.risk]}>{RISK_LABEL[p.risk]}</Badge>
                            </TableCell>
                            <TableCell>
                              <PositionDialog position={p} names={names} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {v.positions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-foreground">Resumo do plano de sucessão</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Distribution title="Criticidade" rows={v.summary.criticality} />
                      <Distribution title="Potencial dos sucessores" rows={v.summary.potential} />
                      <Distribution title="Risco da posição" rows={v.summary.risk} />
                      <Distribution title="Prontidão do sucessor" rows={v.summary.readiness} />
                    </div>
                    <p className="text-xs text-foreground-subtle">Percentuais sobre os {v.summary.total} cargos do plano.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
