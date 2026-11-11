import Link from "next/link";
import { ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck, Upload, CalendarRange } from "lucide-react";
import { requireUser, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  currentDayKey,
  currentMonthKey,
  getGuardianAdherence,
  getLeadershipSettings,
  isValidMonthKey,
  listGuardianReportsOfMonth,
  listPendingGoldenRulesOutsideMonth,
} from "@/server/services/guardian.service";
import { clampPeriodToMonth, GOLDEN_RULE_OUTCOME_LABELS, parseDayKey, parseGroupFilter, type GuardianGroupFilter } from "@/domain/guardian/golden-rule";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import { formatWallClockDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuardianReportTableRow } from "./guardian-report-table-row";
import { GuardianChampions } from "./guardian-champions";
import { ReopenMonthButton } from "./reopen-month-button";
import { TypeShareChart } from "./type-share-chart";
import { GoldenRuleActions } from "./golden-rule-actions";
import { LeadershipSettings } from "./leadership-settings";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** AAAA-MM-DD -> DD/MM */
function shortDay(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

const GROUP_LABEL: Record<GuardianGroupFilter, string> = { geral: "Geral (os dois juntos)", operacao: "Operação", lideranca: "Liderança" };

export default async function GuardianPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; grupo?: string; de?: string; ate?: string; ouro?: string }>;
}) {
  const user = await requireUser();
  const canImport = hasPermission(user, PERMISSIONS.GUARDIAN_MANAGE);
  if (!canImport && !hasPermission(user, PERMISSIONS.GUARDIAN_VIEW)) throw new ForbiddenError();
  // A ficha do colaborador exige acesso de gestão/RH — pra quem só visualiza (Auditor) o nome vira texto.
  const canOpenProfiles = canImport || hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE) || hasPermission(user, PERMISSIONS.HR_MANAGE);

  const { mes, grupo, de, ate, ouro } = await searchParams;
  const nowMonth = currentMonthKey();
  const month = isValidMonthKey(mes) && mes <= nowMonth ? mes : nowMonth;
  const group = parseGroupFilter(grupo);
  const onlyGolden = ouro === "1";
  const period = clampPeriodToMonth(month, parseDayKey(de), parseDayKey(ate));

  const [allReports, { selected: adherence, history }, pendingElsewhere, leadership] = await Promise.all([
    listGuardianReportsOfMonth(user, month),
    getGuardianAdherence(user, month, period),
    listPendingGoldenRulesOutsideMonth(user, month).catch(() => []),
    canImport ? getLeadershipSettings(user) : Promise.resolve(null),
  ]);

  const isCurrentMonth = month === nowMonth;

  function href(over: { mes?: string; grupo?: string; de?: string; ate?: string; ouro?: string } = {}): string {
    const v = { mes: month, grupo: group === "geral" ? undefined : group, de: period?.from, ate: period?.to, ouro: onlyGolden ? "1" : undefined, ...over };
    const q = new URLSearchParams();
    if (v.mes && v.mes !== nowMonth) q.set("mes", v.mes);
    if (v.grupo && v.grupo !== "geral") q.set("grupo", v.grupo);
    if (v.de) q.set("de", v.de);
    if (v.ate) q.set("ate", v.ate);
    if (v.ouro) q.set("ouro", v.ouro);
    const qs = q.toString();
    return qs ? `/guardian?${qs}` : "/guardian";
  }

  // Visão escolhida (geral = os dois juntos): estatísticas, tipos, campeões e quem não relatou seguem o grupo.
  const view = group === "operacao" && adherence.groups ? adherence.groups.operacao : group === "lideranca" && adherence.groups ? adherence.groups.lideranca : adherence;

  // Quem ainda não relatou, agrupado por turno (turnos em ordem; "sem turno" por último).
  const notReportedByTurno = Array.from(
    view.notReported.reduce((map, c) => {
      map.set(c.turnoName, [...(map.get(c.turnoName) ?? []), c]);
      return map;
    }, new Map<string | null, typeof view.notReported>()),
  )
    .map(([turno, people]) => ({ turno, people }))
    .sort((a, b) => (a.turno === null ? 1 : b.turno === null ? -1 : a.turno.localeCompare(b.turno, "pt-BR", { numeric: true })));

  // Relatos da lista: o grupo escolhido, o período e (se ligado) só Regra de Ouro.
  const dayOf = (r: { occurredAt: Date | null; reportedAt: Date | null }) => (r.occurredAt ?? r.reportedAt)?.toISOString().slice(0, 10) ?? null;
  const reports = allReports.filter((r) => {
    if (group !== "geral" && (group === "lideranca") !== r.isLeader) return false;
    if (period) {
      const d = dayOf(r);
      if (!d || d < period.from || d > period.to) return false;
    }
    return !onlyGolden || r.goldenRule;
  });

  // Fila das Regras de Ouro do mês (não segue filtro: é uma pendência a resolver).
  const goldenReports = allReports.filter((r) => r.goldenRule);
  const goldenPending = goldenReports.filter((r) => !r.goldenReview);
  const pendingElsewhereTotal = pendingElsewhere.reduce((s, p) => s + p.count, 0);

  // Atalho "últimos 7 dias": termina hoje (mês em andamento) ou no último dia do mês (mês fechado).
  const todayKey = currentDayKey();
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const weekEnd = isCurrentMonth ? (todayKey < monthEnd ? todayKey : monthEnd) : monthEnd;
  const weekStart = new Date(new Date(`${weekEnd}T00:00:00Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const overview: { key: GuardianGroupFilter; stats: { adherencePercent: number; reportedCount: number; activeCollaboratorsCount: number; reportsCount: number } }[] = [
    { key: "geral", stats: adherence },
    ...(adherence.groups
      ? ([
          { key: "operacao", stats: adherence.groups.operacao },
          { key: "lideranca", stats: adherence.groups.lideranca },
        ] as const)
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Guardian"
        description="Relatos de segurança importados do Guardian — comportamento de risco, condição insegura, incidente e reconhecimento."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {leadership && <LeadershipSettings functions={leadership.functions} configured={leadership.configured} />}
            {canImport && (
              <Button asChild size="sm">
                <Link href="/guardian/importar">
                  <Upload className="size-4" /> Importar planilha
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <PageBody>
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={href({ mes: shiftMonth(month, -1), de: undefined, ate: undefined })}>
              <ChevronLeft className="size-4" /> Mês anterior
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{monthLabel(month)}</p>
            {!isCurrentMonth && (
              <Link href={href({ mes: nowMonth, de: undefined, ate: undefined })} className="text-xs text-accent hover:underline">
                Voltar para o mês atual
              </Link>
            )}
          </div>
          {isCurrentMonth ? (
            <Button variant="secondary" size="sm" disabled>
              Próximo mês <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={href({ mes: shiftMonth(month, 1), de: undefined, ate: undefined })}>
                Próximo mês <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        {(goldenReports.length > 0 || pendingElsewhereTotal > 0) && (
          <Card className={goldenPending.length > 0 || pendingElsewhereTotal > 0 ? "border-danger/50" : undefined}>
            <CardHeader>
              <CardTitle>
                <span className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className={cn("size-4", goldenPending.length > 0 || pendingElsewhereTotal > 0 ? "text-danger" : "text-foreground-subtle")} />
                  Regra de Ouro — {monthLabel(month)}
                  {goldenPending.length > 0 ? <Badge tone="danger">{goldenPending.length} aguardando conclusão</Badge> : goldenReports.length > 0 ? <Badge tone="success">Tudo concluído</Badge> : null}
                </span>
              </CardTitle>
              <CardDescription>
                Relatos marcados como Regra de Ouro na planilha do Guardian. Cada um precisa ser concluído: MDT aplicado ou desconsiderado.
                {pendingElsewhereTotal > 0 && (
                  <span className="mt-1 block font-medium text-danger">
                    Ainda há pendentes em outros meses:{" "}
                    {pendingElsewhere.map((p, i) => (
                      <span key={p.month}>
                        {i > 0 && ", "}
                        <Link href={href({ mes: p.month, de: undefined, ate: undefined })} className="underline">
                          {monthLabel(p.month)} ({p.count})
                        </Link>
                      </span>
                    ))}
                    .
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            {goldenReports.length > 0 && (
              <CardContent className="flex flex-col gap-3">
                {goldenReports.map((r) => (
                  <div key={r.id} className={cn("flex flex-col gap-2 rounded-lg border p-3 text-sm", r.goldenReview ? "border-border bg-surface" : "border-danger/40 bg-danger-soft/40")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{GUARDIAN_TYPE_LABELS[r.type]}</Badge>
                      <span className="text-xs text-foreground-subtle">{r.occurredAt ? formatWallClockDateTime(r.occurredAt) : "—"}</span>
                      {r.area && <span className="text-xs text-foreground-subtle">· {r.area}</span>}
                      <span className="ml-auto">
                        {r.goldenReview ? (
                          <Badge tone={r.goldenReview.outcome === "APLICADO_MDT" ? "success" : "neutral"}>{GOLDEN_RULE_OUTCOME_LABELS[r.goldenReview.outcome]}</Badge>
                        ) : (
                          <Badge tone="danger">Pendente</Badge>
                        )}
                      </span>
                    </div>
                    <p className="text-foreground-muted">
                      <span className="text-xs text-foreground-subtle">Relatado por </span>
                      {r.reporterCollaborator ? (
                        canOpenProfiles ? (
                          <Link href={`/colaboradores/${r.reporterCollaborator.id}`} className="text-accent hover:underline">
                            {r.reporterCollaborator.name}
                          </Link>
                        ) : (
                          r.reporterCollaborator.name
                        )
                      ) : (
                        "—"
                      )}
                      <Badge tone={r.isLeader ? "accent" : "neutral"} className="ml-2">
                        {r.isLeader ? "Liderança" : "Operação"}
                      </Badge>
                      {r.reported?.name && (
                        <>
                          <span className="ml-3 text-xs text-foreground-subtle">Reportado </span>
                          {r.reported.name}
                          {r.reported.company ? ` (${r.reported.company})` : ""}
                        </>
                      )}
                    </p>
                    {r.description && <p className="line-clamp-3 whitespace-pre-wrap text-foreground-muted">{r.description}</p>}
                    {r.goldenReview && (
                      <p className="text-xs text-foreground-subtle">
                        Concluído por {r.goldenReview.decidedByName} em {r.goldenReview.decidedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        {r.goldenReview.note ? ` — ${r.goldenReview.note}` : ""}
                      </p>
                    )}
                    {canImport && <GoldenRuleActions guardianId={r.guardianId} decided={!!r.goldenReview} />}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-foreground-subtle">Ver:</span>
              {(["geral", "operacao", "lideranca"] as const).map((g) => (
                <Link
                  key={g}
                  href={href({ grupo: g })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    g === group ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground-muted hover:bg-surface-muted",
                  )}
                >
                  {GROUP_LABEL[g]}
                </Link>
              ))}
              <Link
                href={href({ ouro: onlyGolden ? undefined : "1" })}
                className={cn(
                  "ml-auto rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  onlyGolden ? "border-danger bg-danger-soft text-danger" : "border-border text-foreground-muted hover:bg-surface-muted",
                )}
              >
                Só Regra de Ouro
              </Link>
            </div>

            <form method="get" action="/guardian" className="flex flex-wrap items-end gap-3">
              {month !== nowMonth && <input type="hidden" name="mes" value={month} />}
              {group !== "geral" && <input type="hidden" name="grupo" value={group} />}
              {onlyGolden && <input type="hidden" name="ouro" value="1" />}
              <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
                De
                <input type="date" name="de" defaultValue={period?.from ?? ""} min={`${month}-01`} max={monthEnd} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
                Até
                <input type="date" name="ate" defaultValue={period?.to ?? ""} min={`${month}-01`} max={monthEnd} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
              </label>
              <Button type="submit" size="md" variant="secondary">
                <CalendarRange className="size-4" /> Filtrar dias
              </Button>
              <Button asChild size="md" variant="ghost">
                <Link href={href({ de: weekStart, ate: weekEnd })}>Últimos 7 dias</Link>
              </Button>
              {period && (
                <Button asChild size="md" variant="ghost">
                  <Link href={href({ de: undefined, ate: undefined })}>Limpar filtro de dias</Link>
                </Button>
              )}
            </form>
            {period && (
              <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">
                Vendo só os relatos de {shortDay(period.from)} a {shortDay(period.to)}. O fechamento do mês não muda — limpe o filtro para voltar a ele.
              </p>
            )}
          </CardContent>
        </Card>

        {overview.length > 1 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {overview.map(({ key, stats }) => (
              <Link
                key={key}
                href={href({ grupo: key })}
                className={cn("rounded-lg border bg-surface p-4 transition-colors hover:bg-surface-muted", key === group ? "border-accent ring-1 ring-accent" : "border-border")}
              >
                <p className="text-xs font-medium text-foreground-subtle">{key === "geral" ? "Geral — operação + liderança" : key === "lideranca" ? "Liderança (time ADM)" : "Operação"}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{stats.adherencePercent}%</p>
                <p className="text-xs text-foreground-subtle">
                  {stats.reportedCount} de {stats.activeCollaboratorsCount} relataram · {stats.reportsCount} relato(s)
                </p>
              </Link>
            ))}
          </div>
        )}
        {adherence.groupsLive && (
          <p className="text-xs text-foreground-subtle">
            Este mês foi fechado antes da separação entre liderança e operação: o geral continua travado, mas a divisão foi calculada agora.
            {canImport && " Use \"Recalcular este mês\" para travar a divisão também."}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="size-4" /> Adesão ao Guardian — {GROUP_LABEL[group]} — {monthLabel(month)}
                {period && <Badge tone="info">{shortDay(period.from)} a {shortDay(period.to)}</Badge>}
                {adherence.frozen && !period && <Badge tone="success">Mês fechado: valores travados</Badge>}
                {adherence.frozen && !period && canImport && <ReopenMonthButton month={month} label={monthLabel(month)} />}
              </span>
            </CardTitle>
            <CardDescription>
              Dos colaboradores que estavam ativos no mês, quantos relataram pelo menos uma vez (qualquer tipo). A conta recomeça do zero a cada mês
              e o mês atual só se atualiza a cada importação. Quando o mês fecha, o resultado final fica travado e não muda mais.
              {adherence.lastReportDay && (
                <span className="mt-1 block font-medium text-foreground-muted">
                  Relatos importados até {adherence.lastReportDay.slice(8, 10)}/{adherence.lastReportDay.slice(5, 7)}/{adherence.lastReportDay.slice(0, 4)}.
                  {month === nowMonth && adherence.lastReportDay.slice(0, 7) < month && " Ainda não há relato importado deste mês."}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-foreground-subtle">{period ? "Relataram no período" : "Relataram no mês"}</p>
                <p className="text-2xl font-semibold text-success tabular-nums">{view.reportedCount}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Não relataram</p>
                <p className={`text-2xl font-semibold tabular-nums ${view.notReportedCount > 0 ? "text-warning" : "text-success"}`}>
                  {view.notReportedCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Adesão</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{view.adherencePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-foreground-subtle">Colaboradores no mês</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{view.activeCollaboratorsCount}</p>
              </div>
            </div>

            {view.byType.length > 0 && <TypeShareChart byType={view.byType} frozen={adherence.frozen && !period} monthLabel={period ? `${shortDay(period.from)} a ${shortDay(period.to)}` : monthLabel(month)} />}

            <GuardianChampions ranking={view.ranking} canOpenProfiles={canOpenProfiles} monthLabel={monthLabel(month)} />

            {view.notReported.length > 0 && (
              <details open className="rounded-md border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
                  Quem ainda não relatou {period ? "no período" : "neste mês"} ({view.notReported.length}) — por turno
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {notReportedByTurno.map((g) => (
                    <div key={g.turno ?? "sem-turno"} className="rounded-lg border border-border bg-surface-muted p-3">
                      <p className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>{g.turno ? `Turno ${g.turno}` : "Sem turno definido"}</span>
                        <span className="rounded bg-warning-soft px-1.5 py-0.5 text-warning tabular-nums">{g.people.length}</span>
                      </p>
                      <ul className="flex flex-col gap-1">
                        {g.people.map((c) => (
                          <li key={c.collaboratorId}>
                            {canOpenProfiles ? (
                              <Link href={`/colaboradores/${c.collaboratorId}`} className="text-accent hover:underline">
                                {c.name}
                              </Link>
                            ) : (
                              <span>{c.name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico mensal</CardTitle>
            <CardDescription>Adesão geral de cada mês, calculada com quem estava ativo naquele mês. Clique para abrir o mês.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Colaboradores</TableHead>
                  <TableHead>Relataram</TableHead>
                  <TableHead>Adesão</TableHead>
                  <TableHead>Relatos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.month}>
                    <TableCell>
                      <Link href={href({ mes: h.month, de: undefined, ate: undefined })} className={h.month === month ? "font-semibold text-foreground" : "text-accent hover:underline"}>
                        {monthLabel(h.month)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.activeCollaboratorsCount}</TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.reportedCount}</TableCell>
                    <TableCell>
                      <Badge tone={h.adherencePercent >= 70 ? "success" : h.adherencePercent >= 40 ? "warning" : "danger"}>
                        {h.adherencePercent}%
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground-subtle">{h.reportsCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Relatos de {monthLabel(month)}
              {group !== "geral" ? ` — ${GROUP_LABEL[group]}` : ""}
              {period ? ` — ${shortDay(period.from)} a ${shortDay(period.to)}` : ""}
              {onlyGolden ? " — só Regra de Ouro" : ""} ({reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && <TableEmpty colSpan={5} />}
                {reports.map((r) => (
                  <GuardianReportTableRow
                    key={r.id}
                    report={{
                      id: r.id,
                      guardianId: r.guardianId,
                      type: r.type,
                      categoryName: r.categoryName,
                      description: r.description,
                      occurredAt: r.occurredAt,
                      reportedAt: r.reportedAt,
                      unit: r.unit,
                      area: r.area,
                      subArea: r.subArea,
                      location: r.location,
                      equipment: r.equipment,
                      isAnonymous: r.isAnonymous,
                    }}
                    reporter={r.reporterCollaborator ? { id: r.reporterCollaborator.id, name: r.reporterCollaborator.name } : null}
                    canOpenProfile={canOpenProfiles}
                    isLeader={r.isLeader}
                    goldenRule={r.goldenRule}
                    goldenStatus={r.goldenReview ? GOLDEN_RULE_OUTCOME_LABELS[r.goldenReview.outcome] : null}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
