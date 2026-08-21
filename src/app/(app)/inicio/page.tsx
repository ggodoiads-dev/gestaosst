import Link from "next/link";
import { Suspense } from "react";
import { Sparkles, ClipboardCheck, HardHat, GraduationCap } from "lucide-react";
import { requireUser, hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getColaboradorSummary, getGestaoSummary } from "@/server/services/indicators.service";
import { getEquipmentRiskRanking, type EquipmentRisk } from "@/server/services/risk-score.service";
import { getHrDailyStats } from "@/server/services/collaborator.service";
import { getDailyBriefing, type DailyBriefingContext } from "@/server/services/rico.service";
import { getChecklistComplianceDashboard } from "@/server/services/checklist-compliance.service";
import { getAccidentMonthlyStats } from "@/server/services/accident.service";
import { getExpiringQualifications } from "@/server/services/qualification.service";
import { getEquipmentDamageCostSummary } from "@/server/services/equipment-damage.service";
import { RicoAvatar } from "@/components/rico/rico-avatar";
import { getNavGroups } from "@/components/layout/nav-items";
import { CommandPalette } from "./command-palette";
import { formatLongDate, APP_TIMEZONE } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

function greeting(): string {
  const hour = Number(formatInTimeZone(new Date(), APP_TIMEZONE, "H"));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function HeroBriefingSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="size-8 shrink-0 animate-pulse rounded-full bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

async function HeroBriefingCard({ user, context }: { user: CurrentUser; context: DailyBriefingContext }) {
  const briefing = await getDailyBriefing(user, context);
  if (!briefing) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <div className="size-8 shrink-0">
        <RicoAvatar state="idle" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-accent">
          <Sparkles className="size-3" /> Rico
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/90">{briefing}</p>
      </div>
    </div>
  );
}

function riskTone(score: number): "success" | "warning" | "danger" {
  if (score > 60) return "danger";
  if (score > 30) return "warning";
  return "success";
}

function RiskWidget({ riskRanking }: { riskRanking: EquipmentRisk[] }) {
  if (riskRanking.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" /> Maior risco agora
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {riskRanking.slice(0, 4).map((item) => (
          <Link
            key={item.equipmentId}
            href={`/equipamentos/${item.equipmentId}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
          >
            <span className="min-w-0 flex-1 truncate">
              {item.equipmentCode} <span className="text-foreground-subtle">— {item.equipmentName}</span>
            </span>
            <Badge tone={riskTone(item.score)}>{item.score}</Badge>
          </Link>
        ))}
      </CardContent>
      <CardFooter className="justify-end py-2.5">
        <Link href="/indicadores" className="text-xs font-medium text-accent hover:underline">
          Ver painel completo →
        </Link>
      </CardFooter>
    </Card>
  );
}

type GestaoSummary = NonNullable<Awaited<ReturnType<typeof getGestaoSummary>>>;

function EquipmentStatusCard({ summary }: { summary: GestaoSummary }) {
  const segments = [
    { label: "Liberados", value: summary.equipamentosLiberados, dot: "bg-success", bar: "bg-success" },
    { label: "Com observação", value: summary.equipamentosObservacao, dot: "bg-info", bar: "bg-info" },
    { label: "Restritos", value: summary.equipamentosRestritos, dot: "bg-warning", bar: "bg-warning" },
    { label: "Bloqueados", value: summary.equipamentosBloqueados, dot: "bg-danger", bar: "bg-danger" },
    { label: "Em manutenção", value: summary.equipamentosManutencao, dot: "bg-foreground-subtle", bar: "bg-foreground-subtle" },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Situação dos equipamentos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {total === 0 ? (
          <p className="text-sm text-foreground-subtle">Nenhum equipamento cadastrado ainda.</p>
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-soft">
              {segments
                .filter((s) => s.value > 0)
                .map((s) => (
                  <div key={s.label} className={s.bar} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-foreground-subtle sm:grid-cols-1">
              {segments.map((s) => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2 shrink-0 rounded-full", s.dot)} />
                  {s.label}: <strong className="text-foreground">{s.value}</strong>
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type ChecklistComplianceDashboard = NonNullable<Awaited<ReturnType<typeof getChecklistComplianceDashboard>>>;

function PersonChecklistCard({ dashboard }: { dashboard: ChecklistComplianceDashboard }) {
  const { today } = dashboard;
  const pct = today.collaboratorsScheduled === 0 ? 100 : Math.round((today.collaboratorsComplete / today.collaboratorsScheduled) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2"><ClipboardCheck className="size-4 text-accent" /> Checklist por pessoa hoje</span>
        </CardTitle>
        <CardDescription>Colaboradores escalados pra trabalhar hoje com checklist obrigatório.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {today.collaboratorsScheduled === 0 ? (
          <p className="text-sm text-foreground-subtle">Ninguém com checklist obrigatório escalado hoje.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-semibold tabular-nums", pct === 100 ? "text-success" : pct >= 70 ? "text-warning" : "text-danger")}>
                {pct}%
              </span>
              <span className="text-sm text-foreground-subtle">
                {today.collaboratorsComplete} de {today.collaboratorsScheduled} cumpriram
              </span>
            </div>
            {today.collaboratorsIncomplete.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {today.collaboratorsIncomplete.slice(0, 6).map((c) => (
                  <Badge key={c.id} tone="danger">{c.name}</Badge>
                ))}
                {today.collaboratorsIncomplete.length > 6 && (
                  <Badge tone="neutral">+{today.collaboratorsIncomplete.length - 6}</Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="justify-end py-2.5">
        <Link href="/indicadores" className="text-xs font-medium text-accent hover:underline">
          Ver painel completo →
        </Link>
      </CardFooter>
    </Card>
  );
}

type AccidentMonthlyStats = Awaited<ReturnType<typeof getAccidentMonthlyStats>>;

function AccidentsMonthCard({ stats }: { stats: AccidentMonthlyStats }) {
  const currentMonthCount = stats.monthly[new Date().getMonth()]?.count ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2"><HardHat className="size-4 text-warning" /> Acidentes e incidentes</span>
        </CardTitle>
        <CardDescription>Registrados neste mês, sem contar cancelados.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{currentMonthCount}</span>
        {stats.topType && (
          <p className="text-sm text-foreground-subtle">
            Tipo mais recorrente no ano: <span className="text-foreground">{stats.topType.label}</span> ({stats.topType.count})
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end py-2.5">
        <Link href="/acidentes" className="text-xs font-medium text-accent hover:underline">
          Ver todos →
        </Link>
      </CardFooter>
    </Card>
  );
}

type ExpiringQualifications = Awaited<ReturnType<typeof getExpiringQualifications>>;

function QualificationsExpiringCard({ expiring }: { expiring: ExpiringQualifications }) {
  const total = expiring.expired.length + expiring.expiringSoon.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2"><GraduationCap className="size-4 text-info" /> NR/ASO vencendo</span>
        </CardTitle>
        <CardDescription>Vencidas ou vencendo nos próximos {Math.round(expiring.withinDays / 30)} meses.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {total === 0 ? (
          <p className="text-sm text-foreground-subtle">Nada vencendo nesse período.</p>
        ) : (
          <div className="flex items-baseline gap-3">
            {expiring.expired.length > 0 && (
              <span className="text-sm">
                <strong className="text-lg text-danger tabular-nums">{expiring.expired.length}</strong>{" "}
                <span className="text-foreground-subtle">vencida(s)</span>
              </span>
            )}
            {expiring.expiringSoon.length > 0 && (
              <span className="text-sm">
                <strong className="text-lg text-warning tabular-nums">{expiring.expiringSoon.length}</strong>{" "}
                <span className="text-foreground-subtle">vencendo</span>
              </span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end py-2.5">
        <Link href="/qualificacoes" className="text-xs font-medium text-accent hover:underline">
          Ver painel completo →
        </Link>
      </CardFooter>
    </Card>
  );
}

export default async function InicioPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];

  const canSeeGestao =
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);
  const canSeeChecklistCompliance = hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW);
  const canSeeAccidents = hasPermission(user, PERMISSIONS.ACCIDENT_MANAGE);
  const canSeeQualifications = hasPermission(user, PERMISSIONS.QUALIFICATION_MANAGE);
  const canSeeFleet = hasPermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);

  const [colaboradorSummary, gestaoSummary, riskRanking, hrStats, checklistComplianceDashboard, accidentStats, expiringQualifications, fleetDamageSummary] =
    await Promise.all([
      getColaboradorSummary(user),
      canSeeGestao ? getGestaoSummary(user) : Promise.resolve(null),
      canSeeGestao ? getEquipmentRiskRanking(user, 4) : Promise.resolve([]),
      canSeeHr ? getHrDailyStats(user) : Promise.resolve(null),
      canSeeChecklistCompliance ? getChecklistComplianceDashboard(user) : Promise.resolve(null),
      canSeeAccidents ? getAccidentMonthlyStats(user) : Promise.resolve(null),
      canSeeQualifications ? getExpiringQualifications(user, 90) : Promise.resolve(null),
      canSeeFleet
        ? getEquipmentDamageCostSummary(user, {
            from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59),
          })
        : Promise.resolve(null),
    ]);
  const headlineSummary = gestaoSummary ?? colaboradorSummary;

  const navGroups = getNavGroups(user);

  const briefingContext: DailyBriefingContext = {
    seguranca: {
      previstos: colaboradorSummary.previstos,
      realizados: colaboradorSummary.realizados,
      atrasados: colaboradorSummary.atrasados,
      ncAbertas: gestaoSummary?.ncAbertas ?? null,
      topRisk: riskRanking[0] ? { equipmentCode: riskRanking[0].equipmentCode, score: riskRanking[0].score } : null,
    },
    gestao: gestaoSummary
      ? {
          percentualCumprimento: gestaoSummary.percentualCumprimento,
          equipamentosBloqueados: gestaoSummary.equipamentosBloqueados,
          acoesVencidas: gestaoSummary.acoesVencidas,
        }
      : undefined,
    rh: hrStats ?? undefined,
    frota: fleetDamageSummary
      ? { avariasAbertasNoMes: fleetDamageSummary.openCount, custoAvariasNoMes: fleetDamageSummary.totalCost }
      : undefined,
  };

  return (
    <PageBody>
      <div className="relative overflow-hidden rounded-xl bg-brand animate-fade-up">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent/25 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-white/60">{formatLongDate()}</p>
            <div className="mt-4 max-w-xl">
              <Suspense fallback={<HeroBriefingSkeleton />}>
                <HeroBriefingCard user={user} context={briefingContext} />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="relative px-6 pb-6 sm:px-8 sm:pb-8">
          <CommandPalette groups={navGroups} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <StatCard label="Checklists de equipamento previstos hoje" value={headlineSummary.previstos} />
        <StatCard
          label="Realizados"
          value={headlineSummary.realizados}
          tone={headlineSummary.realizados === headlineSummary.previstos && headlineSummary.previstos > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Atrasados"
          value={headlineSummary.atrasados}
          tone={headlineSummary.atrasados > 0 ? "danger" : "success"}
        />
        {gestaoSummary ? (
          <StatCard
            label="Não conformidades abertas"
            value={gestaoSummary.ncAbertas}
            tone={gestaoSummary.ncAbertas > 0 ? "warning" : "success"}
            href="/nao-conformidades"
          />
        ) : (
          <StatCard label="Pendentes" value={headlineSummary.pendentes} tone={headlineSummary.pendentes > 0 ? "warning" : "success"} />
        )}
      </div>

      {gestaoSummary && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <RiskWidget riskRanking={riskRanking} />
          <EquipmentStatusCard summary={gestaoSummary} />
        </div>
      )}

      {(checklistComplianceDashboard || accidentStats || expiringQualifications) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {checklistComplianceDashboard && <PersonChecklistCard dashboard={checklistComplianceDashboard} />}
          {accidentStats && <AccidentsMonthCard stats={accidentStats} />}
          {expiringQualifications && <QualificationsExpiringCard expiring={expiringQualifications} />}
        </div>
      )}
    </PageBody>
  );
}
