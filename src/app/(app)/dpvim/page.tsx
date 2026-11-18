import Link from "next/link";
import { Building2, CalendarRange, Clock, Truck } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { currentDayKey } from "@/server/services/guardian.service";
import { getDpvimDashboard } from "@/server/services/dpvim.service";
import { DPVIM_SITUATION_LABEL, dpvimKindLabel, formatHours, type DpvimSituation } from "@/domain/dpvim/rules";
import { parseDayKey } from "@/domain/guardian/golden-rule";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonutStat } from "@/components/domain/charts/donut-stat";
import { HorizontalBarChart } from "@/components/domain/charts/horizontal-bar-chart";
import { DpvimFormDialog } from "./dpvim-form-dialog";
import { DpvimKindsDialog } from "./kinds-dialog";
import { DivergenceSection } from "./divergence-section";
import { StartDpvimDialog } from "./start-dialog";
import { StopDpvimDialog } from "./stop-dialog";
import { ArrivalsChart } from "./dpvim-charts";
import { ProgressBar, SituationBadge } from "./situation-badge";

const SITUATIONS: DpvimSituation[] = ["ATRASADA", "VENCE_LOGO", "NO_PRAZO", "CONCLUIDA_NO_PRAZO", "CONCLUIDA_ATRASADA", "CANCELADA"];

function addDays(key: string, delta: number): string {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + delta * 86400000).toISOString().slice(0, 10);
}

export default async function DpvimPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; tipo?: string; situacao?: string; nota?: string }> }) {
  const user = await requireUser();
  const { de, ate, tipo, situacao, nota } = await searchParams;
  const situation = SITUATIONS.find((s) => s === situacao) ?? null;
  const from = parseDayKey(de);
  const to = parseDayKey(ate);
  const hasPeriod = !!(from || to);

  const data = await getDpvimDashboard(user, { from, to, kind: tipo ?? null, situation, invoicePending: nota === "pendente" });
  const onlyPending = nota === "pendente" && data.canSeeInvoice;
  // O tipo do filtro só vale se existir (os de fábrica e os cadastrados).
  const kind = data.kinds.find((k) => k.key === tipo)?.key ?? null;
  const kindName = (key: string) => dpvimKindLabel(key, data.kinds);
  const todayKey = currentDayKey();

  function href(over: { de?: string; ate?: string; tipo?: string; situacao?: string; nota?: string } = {}) {
    const v = { de: from ?? undefined, ate: to ?? undefined, tipo: kind ?? undefined, situacao: situation ?? undefined, nota: onlyPending ? "pendente" : undefined, ...over };
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val) q.set(k, val);
    const qs = q.toString();
    return qs ? `/dpvim?${qs}` : "/dpvim";
  }

  const dv = data.divergence;
  const late = data.rows.filter((r) => r.situation === "ATRASADA");
  const k = data.kpis;
  const doneTotal = k.doneOnTime + k.doneLate;
  const canStart = data.hasCollaborator && !data.mySession;
  const arrivalsBars = data.arrivalsByDay.map((d) => ({ label: `${d.dayKey.slice(8, 10)}/${d.dayKey.slice(5, 7)}`, arrived: d.arrived, concluded: d.concluded }));

  return (
    <>
      <PageHeader
        title="DPVIM"
        description="Cargas de retorno (paletes, chapatex e quadros) para selecionar e separar. O prazo para rebater é de 48h a partir da chegada."
        actions={
          data.canLaunch ? (
            <div className="flex flex-wrap items-center gap-2">
              {data.canManage && <DpvimKindsDialog kinds={data.kinds} disabled={!data.kindsReady} />}
              {data.canManage && (
                <Button asChild variant="secondary" disabled={!data.suppliersReady}>
                  <Link href="/dpvim/fornecedores">
                    <Building2 className="size-4" /> Fornecedores
                  </Link>
                </Button>
              )}
              <DpvimFormDialog disabled={!data.ready} kinds={data.kinds} suppliers={data.suppliers} suppliersReady={data.suppliersReady} />
            </div>
          ) : undefined
        }
      />
      <PageBody className="flex flex-col gap-6">
        {!data.ready && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            A atualização do banco de dados da DPVIM ainda não foi aplicada, então ainda não dá para cadastrar nem abrir DPVIM.
          </div>
        )}

        {data.canManage && !data.kindsReady && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            A atualização do banco de dados para cadastrar tipos de DPVIM ainda não foi aplicada. Enquanto isso, só os tipos de fábrica (palete, chapatex e quadro) estão disponíveis.
          </div>
        )}

        {data.canManage && !data.suppliersReady && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
            A atualização do banco de dados para cadastrar fornecedores ainda não foi aplicada. Enquanto isso, &ldquo;De onde veio&rdquo; continua como texto livre.
          </div>
        )}

        {data.mySession && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Você está com a {data.mySession.dpvimCode} aberta desde {formatDateTime(data.mySession.startedAt)}
                {data.mySession.partnerName ? ` (dupla: ${data.mySession.partnerName})` : ""}
              </p>
              <p className="text-xs text-foreground-subtle">Quando parar, informe quantos itens foram feitos.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/dpvim/${data.mySession.dpvimId}`}>Ver DPVIM</Link>
              </Button>
              <StopDpvimDialog
                sessionId={data.mySession.id}
                code={data.mySession.dpvimCode}
                lines={data.mySession.lines.map((l) => ({ kind: l.kind, label: kindName(l.kind), expected: l.expected }))}
              />
            </div>
          </div>
        )}

        {data.canSeeDashboard && (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-foreground-subtle">Tipo:</span>
                  {[null, ...data.kinds.filter((x) => x.active || x.key === kind).map((x) => x.key)].map((t) => (
                    <Link
                      key={t ?? "todos"}
                      href={href({ tipo: t ?? undefined })}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", t === kind ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground-muted hover:bg-surface-muted")}
                    >
                      {t ? kindName(t) : "Todos"}
                    </Link>
                  ))}
                  <span className="ml-4 text-xs font-medium text-foreground-subtle">Situação:</span>
                  {[null, "ATRASADA", "VENCE_LOGO", "NO_PRAZO"].map((s) => (
                    <Link
                      key={s ?? "todas"}
                      href={href({ situacao: s ?? undefined })}
                      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", s === situation ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground-muted hover:bg-surface-muted")}
                    >
                      {s ? DPVIM_SITUATION_LABEL[s as DpvimSituation] : "Todas"}
                    </Link>
                  ))}
                  {data.canSeeInvoice && (
                    <>
                      <span className="ml-4 text-xs font-medium text-foreground-subtle">Nota:</span>
                      {[null, "pendente"].map((n) => (
                        <Link
                          key={n ?? "todas"}
                          href={href({ nota: n ?? undefined })}
                          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", (n === "pendente") === onlyPending ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground-muted hover:bg-surface-muted")}
                        >
                          {n ? "Falta lançar a nota" : "Todas"}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
                <form method="get" action="/dpvim" className="flex flex-wrap items-end gap-3">
                  {kind && <input type="hidden" name="tipo" value={kind} />}
                  {situation && <input type="hidden" name="situacao" value={situation} />}
                  {onlyPending && <input type="hidden" name="nota" value="pendente" />}
                  <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
                    Chegou de
                    <input type="date" name="de" defaultValue={from ?? ""} max={todayKey} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
                    até
                    <input type="date" name="ate" defaultValue={to ?? ""} max={todayKey} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
                  </label>
                  <Button type="submit" variant="secondary">
                    <CalendarRange className="size-4" /> Filtrar dias
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={href({ de: addDays(todayKey, -6), ate: todayKey })}>Últimos 7 dias</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={href({ de: addDays(todayKey, -29), ate: todayKey })}>Últimos 30 dias</Link>
                  </Button>
                  {hasPeriod && (
                    <Button asChild variant="ghost">
                      <Link href={href({ de: undefined, ate: undefined })}>Limpar</Link>
                    </Button>
                  )}
                </form>
                <p className="text-xs text-foreground-subtle">
                  O período filtra pela chegada. As DPVIM que ainda não foram concluídas aparecem sempre, mesmo as antigas, para uma atrasada não sumir do painel.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Atrasadas" value={k.late} tone={k.late > 0 ? "danger" : "success"} hint="passaram das 48h" />
              <StatCard label="Vencem em 12h" value={k.soon} tone={k.soon > 0 ? "warning" : "neutral"} />
              <StatCard label="Aguardando começar" value={k.open} tone="neutral" />
              <StatCard label="Em andamento" value={k.inProgress} tone="accent" />
              <StatCard label="Rebatidas no prazo" value={k.onTimeRate === null ? "—" : `${k.onTimeRate}%`} tone={k.onTimeRate === null ? "neutral" : k.onTimeRate >= 90 ? "success" : k.onTimeRate >= 70 ? "warning" : "danger"} hint={doneTotal > 0 ? `${k.doneOnTime} de ${doneTotal} concluídas` : "nenhuma concluída ainda"} />
              <StatCard label="Tempo médio para rebater" value={k.avgLeadHours === null ? "—" : formatHours(k.avgLeadHours)} hint="da chegada à conclusão" />
              <StatCard label="Itens contados" value={k.totalDone} hint={`norte do conferente: ${k.totalExpected}`} />
              {data.canSeeInvoice && (
                <StatCard label="Esperando a nota" value={dv.awaitingInvoice.length} tone={dv.awaitingInvoice.length > 0 ? "warning" : "success"} hint="falta lançar a quantidade da nota" />
              )}
              <StatCard label="DPVIM no painel" value={data.rows.filter((r) => r.status !== "CANCELADA").length} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Chegadas e conclusões por dia</CardTitle>
                  <CardDescription>Se as barras azuis passam das verdes por vários dias, o pátio está acumulando.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ArrivalsChart data={arrivalsBars} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Prazo das concluídas</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutStat
                    centerLabel="no prazo"
                    centerValue={k.onTimeRate === null ? "—" : `${k.onTimeRate}%`}
                    segments={[
                      { label: "Concluídas no prazo", value: k.doneOnTime, color: "var(--success)" },
                      { label: "Concluídas com atraso", value: k.doneLate, color: "var(--danger)" },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>De onde vêm</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <HorizontalBarChart data={data.byOrigin.slice(0, 8).map((o) => ({ name: o.origin, value: o.count }))} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Itens feitos por dupla</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <HorizontalBarChart data={data.byPair.slice(0, 8).map((p) => ({ name: p.label, value: p.qty }))} color="var(--success)" />
                </CardContent>
              </Card>
            </div>

            {data.canSeeInvoice && <DivergenceSection data={dv} kinds={data.kinds} />}

            {late.length > 0 && (
              <Card className="border-danger/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-danger">
                    <Clock className="size-4" /> DPVIM atrasadas ({late.length})
                  </CardTitle>
                  <CardDescription>Passaram de 48h da chegada e ainda não foram concluídas.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {late.map((r) => (
                    <Link key={r.id} href={`/dpvim/${r.id}`} className="flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger-soft/40 p-3 transition-colors hover:bg-danger-soft">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{r.code}</span>
                        <SituationBadge situation={r.situation} hoursLeft={r.hoursLeft} />
                      </div>
                      <p className="text-xs text-foreground-subtle">
                        {r.lines.map((l) => `${kindName(l.kind)} ${l.expected}`).join(" + ")}{r.origin ? ` · ${r.origin}` : ""} · chegou {formatDateTime(r.arrivedAt)}
                      </p>
                      <ProgressBar done={r.doneQty} expected={r.expectedQty} progress={r.progress} />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-4" /> Fila de DPVIM ({data.rows.length})
            </CardTitle>
            <CardDescription>As pendentes vêm primeiro, pela que vence antes. {data.hasCollaborator ? "Escolha uma e toque em Abrir e começar." : ""}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-y border-border bg-surface-muted text-left text-xs text-foreground-subtle">
                    <th className="px-4 py-2 font-semibold">DPVIM</th>
                    <th className="px-3 py-2 font-semibold">Chegou</th>
                    <th className="px-3 py-2 font-semibold">Prazo</th>
                    <th className="px-3 py-2 font-semibold">Andamento</th>
                    <th className="px-3 py-2 font-semibold">Quem abriu</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground-subtle">
                        Nenhuma DPVIM {hasPeriod || kind || situation ? "nesse filtro" : "cadastrada ainda"}.
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => {
                    const open = r.status === "ABERTA" || r.status === "EM_ANDAMENTO";
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                        <td className="px-4 py-2.5">
                          <Link href={`/dpvim/${r.id}`} className="font-semibold text-accent hover:underline">
                            {r.code}
                          </Link>
                          <p className="text-xs text-foreground-subtle">
                            {r.lines.map((l) => (
                              <Badge key={l.kind} tone="info" className="mr-1">
                                {kindName(l.kind)} {l.expected}
                              </Badge>
                            ))}
                            {r.origin}
                          </p>
                          {data.canSeeInvoice && r.status !== "CANCELADA" && r.lines.some((l) => l.invoice === null) && (
                            <Badge tone="warning" className="mt-1">
                              Falta lançar a nota
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-foreground-subtle">{formatDateTime(r.arrivedAt)}</td>
                        <td className="px-3 py-2.5">
                          <SituationBadge situation={r.situation} hoursLeft={r.hoursLeft} />
                          <p className="mt-0.5 text-[11px] text-foreground-subtle">até {formatDateTime(r.dueAt)}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <ProgressBar done={r.doneQty} expected={r.expectedQty} progress={r.progress} />
                          {r.balance !== null && r.balance !== 0 && (
                            <p className={cn("mt-0.5 text-[11px] font-semibold", r.balance < 0 ? "text-danger" : "text-warning")}>
                              Divergência: {r.balance < 0 ? `faltou ${-r.balance}` : `sobrou ${r.balance}`}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {r.openNow.length > 0 ? (
                            <p className="font-medium text-accent">
                              Agora: {r.openNow.map((o) => o.name + (o.partnerName ? ` + ${o.partnerName}` : "")).join("; ")}
                            </p>
                          ) : null}
                          {r.firstOpenedBy ? (
                            <p className="text-foreground-subtle">
                              Aberta por {r.firstOpenedBy.name} em {formatDateTime(r.firstOpenedBy.at)}
                              {r.sessionsCount > 1 ? ` · ${r.sessionsCount} atividades` : ""}
                            </p>
                          ) : (
                            <span className="text-foreground-subtle">Ninguém abriu ainda</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {open && canStart ? (
                            <StartDpvimDialog dpvimId={r.id} code={r.code} collaborators={data.collaborators} myCollaboratorId={data.myCollaboratorId} />
                          ) : (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/dpvim/${r.id}`}>Detalhes</Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {data.canSeeDashboard && data.recent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Atividade recente</CardTitle>
              <CardDescription>Quem abriu cada DPVIM, quando, e o que fez ao parar.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.recent.map((s) => (
                <Link key={s.id} href={`/dpvim/${s.dpvimId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted">
                  <span>
                    <strong className="text-foreground">{s.workerName}</strong>
                    {s.partnerName ? ` + ${s.partnerName}` : ""} abriu <strong className="text-accent">{s.dpvimCode}</strong> em {formatDateTime(s.startedAt)}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    {s.stoppedAt ? `parou ${formatDateTime(s.stoppedAt)} · ${s.qtyDone ?? 0} item(ns)` : "em andamento agora"}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
