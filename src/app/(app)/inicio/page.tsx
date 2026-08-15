import Link from "next/link";
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
  ClipboardList,
  RotateCcwClock,
} from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { getColaboradorSummary, getGestaoSummary } from "@/server/services/indicators.service";
import { formatLongDate } from "@/lib/dates";

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

export default async function InicioPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];

  const canSeeGestao =
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);

  const [colaboradorSummary, gestaoSummary] = await Promise.all([
    getColaboradorSummary(user),
    canSeeGestao ? getGestaoSummary(user) : Promise.resolve(null),
  ]);

  const meuTrabalho = [
    {
      href: "/checklist/realizar",
      title: "Realizar Checklist",
      description: "Fazer o checklist dos equipamentos da sua área.",
      icon: <ClipboardCheck className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.CHECKLIST_EXECUTE),
    },
    {
      href: "/minha-produtividade",
      title: "Lançar Produtividade",
      description: "Registrar o que você produziu no turno.",
      icon: <TrendingUp className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.PRODUCTIVITY_SELF_LOG),
    },
    {
      href: "/minha-presenca",
      title: "Confirmar Presença",
      description: "Confirmar que você está presente no turno de hoje.",
      icon: <CheckCircle2 className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.SHIFT_CHECKIN_SELF),
    },
  ].filter((m) => m.visible);

  const equipamentos = [
    {
      href: "/equipamentos/painel",
      title: "Gestão de Equipamentos",
      description: "Checklists, equipamentos, manutenção, não conformidades e indicadores.",
      icon: <Wrench className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.EQUIPMENT_VIEW),
    },
  ].filter((m) => m.visible);

  const sst = [
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
      description: "Cumprimento de checklist, não conformidades e desempenho por área.",
      icon: <BarChart3 className="size-4" />,
      visible: canSeeGestao,
    },
    {
      href: "/checklist/conformidade",
      title: "Conformidade de Checklist",
      description: "Quem cumpriu o checklist do turno, por colaborador.",
      icon: <ClipboardList className="size-4" />,
      visible: hasPermission(user, PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW),
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

        <ModuleSection title="Meu Trabalho" items={meuTrabalho} />
        <ModuleSection title="Equipamentos" items={equipamentos} />
        <ModuleSection title="Segurança" items={sst} />
        <ModuleSection title="RH" items={rh} />
        <ModuleSection title="Supervisão" items={supervisao} />
      </PageBody>
    </>
  );
}
