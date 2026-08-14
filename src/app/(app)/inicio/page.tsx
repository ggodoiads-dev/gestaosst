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
} from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { PageHeader, PageBody } from "@/components/domain/page-header";

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
      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5 transition-transform hover:-translate-y-0.5 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-foreground-subtle" />
    </Link>
  );
}

export default async function InicioPage() {
  const user = await requireUser();

  const modules: { href: string; title: string; description: string; icon: ReactNode; visible: boolean }[] = [
    {
      href: "/checklist/realizar",
      title: "Realizar Checklist",
      description: "Fazer o checklist dos equipamentos da sua área.",
      icon: <ClipboardCheck className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.CHECKLIST_EXECUTE),
    },
    {
      href: "/minha-produtividade",
      title: "Lançar Produtividade",
      description: "Registrar o que você produziu no turno.",
      icon: <TrendingUp className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.PRODUCTIVITY_SELF_LOG),
    },
    {
      href: "/minha-presenca",
      title: "Confirmar Presença",
      description: "Confirmar que você está presente no turno de hoje.",
      icon: <CheckCircle2 className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.SHIFT_CHECKIN_SELF),
    },
    {
      href: "/equipamentos/painel",
      title: "Gestão de Equipamentos",
      description: "Checklists, equipamentos, manutenção, não conformidades e indicadores.",
      icon: <Wrench className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.EQUIPMENT_VIEW),
    },
    {
      href: "/colaboradores",
      title: "Colaboradores",
      description: "Cadastro dos funcionários e histórico de cada um.",
      icon: <UsersRound className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.COLLABORATOR_MANAGE),
    },
    {
      href: "/acidentes",
      title: "Investigação de Acidentes",
      description: "Registro e inventário de acidentes, incidentes e quase acidentes.",
      icon: <HeartPulse className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.ACCIDENT_MANAGE),
    },
    {
      href: "/qualificacoes",
      title: "Qualificações",
      description: "Treinamentos NR, ASO e integrações, com vencimento automático.",
      icon: <GraduationCap className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.QUALIFICATION_MANAGE),
    },
    {
      href: "/atividades",
      title: "Atividades e Documentos",
      description: "Cadastro de atividades com POP e AR/VR de cada uma.",
      icon: <FolderKanban className="size-5" />,
      visible: hasPermission(user, PERMISSIONS.ACTIVITY_MANAGE),
    },
  ];

  const visibleModules = modules.filter((m) => m.visible);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description="Escolha uma área para continuar."
      />
      <PageBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleModules.map((m) => (
            <ModuleTile key={m.href} href={m.href} title={m.title} description={m.description} icon={m.icon} />
          ))}
        </div>
      </PageBody>
    </>
  );
}
