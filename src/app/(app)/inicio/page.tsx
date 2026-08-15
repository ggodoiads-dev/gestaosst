import Link from "next/link";
import { Suspense } from "react";
import type { ReactNode } from "react";
import {
  Wrench,
  UsersRound,
  HeartPulse,
  GraduationCap,
  FolderKanban,
  ChevronRight,
  ClipboardCheck,
  TrendingUp,
  CheckCircle2,
  Wallet,
  Upload,
  BarChart3,
  RotateCcwClock,
  Sparkles,
} from "lucide-react";
import { requireUser, hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getColaboradorSummary, getGestaoSummary } from "@/server/services/indicators.service";
import { getEquipmentRiskRanking, type EquipmentRisk } from "@/server/services/risk-score.service";
import { getHrDailyStats } from "@/server/services/collaborator.service";
import { getDailyBriefing, type DailyBriefingContext } from "@/server/services/rico.service";
import { RicoAvatar } from "@/components/rico/rico-avatar";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

function ModuleTile({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-md border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ModuleSection({ title, items }: { title: string; items: { href: string; title: string; description: string; icon: ReactNode }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{title}</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((m) => (
          <ModuleTile key={m.href} {...m} />
        ))}
      </div>
    </div>
  );
}

function BriefingSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5">
      <div className="size-9 shrink-0 animate-pulse rounded-full bg-surface-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-16 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  );
}

async function DailyBriefingCard({ user, context }: { user: CurrentUser; context: DailyBriefingContext }) {
  const briefing = await getDailyBriefing(user, context);
  if (!briefing) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/25 bg-accent-soft/40 px-4 py-3.5">
      <div className="size-9 shrink-0">
        <RicoAvatar state="idle" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          <Sparkles className="size-3" /> Rico
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">{briefing}</p>
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

export default async function InicioPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];

  const canSeeGestao =
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);
  const canSeeHr = hasPermission(user, PERMISSIONS.HR_MANAGE);

  const [colaboradorSummary, gestaoSummary, riskRanking, hrStats] = await Promise.all([
    getColaboradorSummary(user),
    canSeeGestao ? getGestaoSummary(user) : Promise.resolve(null),
    canSeeGestao ? getEquipmentRiskRanking(user, 4) : Promise.resolve([]),
    canSeeHr ? getHrDailyStats(user) : Promise.resolve(null),
  ]);

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
  };

  const equipamentos = [
    {
      href: "/equipamentos/painel",
      title: "Gestão de Equipamentos",
      description: "Checklists, equipamentos, manutenção, não conformidades e indicadores.",
      icon: <Wrench className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.EQUIPMENT_VIEW),
    },
  ].filter((m) => m.visible);

  const seguranca = [
    {
      href: "/checklist/realizar",
      title: "Realizar Checklist",
      description: "Fazer o checklist dos equipamentos da sua área.",
      icon: <ClipboardCheck className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.CHECKLIST_EXECUTE),
    },
    {
      href: "/colaboradores",
      title: "Colaboradores",
      description: "Cadastro dos funcionários e histórico de cada um.",
      icon: <UsersRound className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE),
    },
    {
      href: "/acidentes",
      title: "Investigação de Acidentes",
      description: "Registro e inventário de acidentes, incidentes e quase acidentes.",
      icon: <HeartPulse className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.ACCIDENT_MANAGE),
    },
    {
      href: "/qualificacoes",
      title: "Qualificações",
      description: "Treinamentos NR, ASO e integrações, com vencimento automático.",
      icon: <GraduationCap className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.QUALIFICATION_MANAGE),
    },
    {
      href: "/atividades",
      title: "Atividades e Documentos",
      description: "Cadastro de atividades com POP e AR/VR de cada uma.",
      icon: <FolderKanban className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.ACTIVITY_MANAGE),
    },
  ].filter((m) => m.visible);

  const rh = [
    {
      href: "/minha-presenca",
      title: "Confirmar Presença",
      description: "Confirmar que você está presente no turno de hoje.",
      icon: <CheckCircle2 className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.SHIFT_CHECKIN_SELF),
    },
    {
      href: "/minha-produtividade",
      title: "Lançar Produtividade",
      description: "Registrar o que você produziu no turno.",
      icon: <TrendingUp className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.PRODUCTIVITY_SELF_LOG),
    },
    {
      href: "/rh",
      title: "Colaboradores (RH)",
      description: "Salário e dados de folha, atualizáveis por planilha.",
      icon: <Wallet className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.HR_MANAGE),
    },
    {
      href: "/rh/importar",
      title: "Importar Planilha",
      description: "Atualizar colaboradores em lote a partir de uma planilha.",
      icon: <Upload className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.HR_MANAGE),
    },
  ].filter((m) => m.visible);

  const supervisao = [
    {
      href: "/indicadores",
      title: "Indicadores",
      description: "Cumprimento de checklist, conformidade por colaborador, não conformidades e desempenho por área.",
      icon: <BarChart3 className="size-4" />,
      visible: canSeeGestao,
    },
    {
      href: "/historico",
      title: "Histórico Geral",
      description: "Consulta completa do que já aconteceu no sistema.",
      icon: <RotateCcwClock className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.HISTORY_VIEW),
    },
  ].filter((m) => m.visible);

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description={formatLongDate()} />
      <PageBody>
        <Suspense fallback={<BriefingSkeleton />}>
          <DailyBriefingCard user={user} context={briefingContext} />
        </Suspense>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Checklists previstos hoje" value={colaboradorSummary.previstos} />
          <StatCard
            label="Realizados"
            value={colaboradorSummary.realizados}
            tone={colaboradorSummary.realizados === colaboradorSummary.previstos && colaboradorSummary.previstos > 0 ? "success" : "neutral"}
          />
          <StatCard
            label="Atrasados"
            value={colaboradorSummary.atrasados}
            tone={colaboradorSummary.atrasados > 0 ? "danger" : "success"}
          />
          {gestaoSummary ? (
            <StatCard
              label="Não conformidades abertas"
              value={gestaoSummary.ncAbertas}
              tone={gestaoSummary.ncAbertas > 0 ? "warning" : "success"}
              href="/nao-conformidades"
            />
          ) : (
            <StatCard label="Pendentes" value={colaboradorSummary.pendentes} tone={colaboradorSummary.pendentes > 0 ? "warning" : "success"} />
          )}
        </div>

        {gestaoSummary && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RiskWidget riskRanking={riskRanking} />
            <EquipmentStatusCard summary={gestaoSummary} />
          </div>
        )}

        <ModuleSection title="Equipamentos" items={equipamentos} />
        <ModuleSection title="Segurança" items={seguranca} />
        <ModuleSection title="RH" items={rh} />
        <ModuleSection title="Supervisão" items={supervisao} />
      </PageBody>
    </>
  );
}
