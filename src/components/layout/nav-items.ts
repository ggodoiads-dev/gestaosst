import {
  LayoutDashboard,
  ClipboardCheck,
  Wrench,
  Hammer,
  AlertTriangle,
  ListChecks,
  History,
  RotateCcwClock,
  BarChart3,
  Building2,
  FileStack,
  Users,
  ShieldCheck,
  UsersRound,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  CheckCircle2,
  HardHat,
  Fingerprint,
  Sparkles,
  Wallet,
  Upload,
  Clock,
  ShoppingBasket,
  UserCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { CurrentUser } from "@/server/auth/current-user";

/**
 * Ícones são referenciados por chave (não pela função do componente) porque
 * este módulo roda no servidor e o resultado atravessa a fronteira RSC até o
 * AppShell (client component) — componentes React não são serializáveis
 * nessa travessia, então o AppShell resolve a chave para o ícone real.
 */
export type NavIconKey =
  | "dashboard"
  | "checklist"
  | "equipment"
  | "maintenance"
  | "alert"
  | "actionPlan"
  | "history"
  | "historyAll"
  | "indicators"
  | "building"
  | "checklistTemplate"
  | "users"
  | "audit"
  | "collaborators"
  | "activities"
  | "qualifications"
  | "accidents"
  | "schedules"
  | "productivity"
  | "checklistCompliance"
  | "myPresence"
  | "epi"
  | "jobFunctions"
  | "rico"
  | "hr"
  | "hrImport"
  | "timeClock"
  | "benefits"
  | "qualificationImport"
  | "equipmentImport"
  | "rollCall"
  | "warningPending";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
};

export type NavGroup = {
  /** Chave estável usada só pra lembrar estado de expandido/recolhido — não é exibida. */
  key: string;
  title?: string;
  items: NavItem[];
};

/** Resolve `NavIconKey` pro componente de ícone real — compartilhado entre a sidebar (AppShell) e a paleta de comandos da tela de início. */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  checklist: ClipboardCheck,
  equipment: Wrench,
  maintenance: Hammer,
  alert: AlertTriangle,
  actionPlan: ListChecks,
  history: History,
  historyAll: RotateCcwClock,
  indicators: BarChart3,
  building: Building2,
  checklistTemplate: FileStack,
  users: Users,
  audit: ShieldCheck,
  collaborators: UsersRound,
  activities: FolderKanban,
  qualifications: GraduationCap,
  accidents: HeartPulse,
  schedules: CalendarDays,
  productivity: TrendingUp,
  checklistCompliance: ClipboardList,
  myPresence: CheckCircle2,
  epi: HardHat,
  jobFunctions: Fingerprint,
  rico: Sparkles,
  hr: Wallet,
  hrImport: Upload,
  timeClock: Clock,
  benefits: ShoppingBasket,
  qualificationImport: Upload,
  equipmentImport: Upload,
  rollCall: UserCheck,
  warningPending: ShieldAlert,
};

/**
 * Reagrupado por área real de uso (seção 68 do documento) — o sistema cresceu módulo a
 * módulo ao longo do projeto (SST → equipamentos → RH) e a navegação tinha acumulado itens
 * parecidos em grupos diferentes (duas entradas de "Colaboradores", "Produtividade" e
 * "Qualificações" espalhadas). Cada item agora aparece uma vez só, no grupo que reflete
 * quem usa aquilo no dia a dia.
 */
export function getNavGroups(user: CurrentUser): NavGroup[] {
  const p = user.permissions;
  const groups: NavGroup[] = [];

  const geral: NavItem[] = [
    { href: "/inicio", label: "Início", icon: "dashboard" },
    { href: "/rico", label: "Rico", icon: "rico" },
    { href: "/meu-historico", label: "Meu Histórico", icon: "history" },
  ];
  groups.push({ key: "geral", items: geral });

  const equipamentos: NavItem[] = [];
  if (p.has(PERMISSIONS.EQUIPMENT_VIEW)) {
    equipamentos.push({ href: "/equipamentos", label: "Equipamentos", icon: "equipment" });
  }
  if (p.has(PERMISSIONS.EQUIPMENT_MAINTENANCE)) {
    equipamentos.push({ href: "/manutencao", label: "Manutenção", icon: "maintenance" });
  }
  if (p.has(PERMISSIONS.NONCONFORMITY_VIEW)) {
    equipamentos.push({ href: "/nao-conformidades", label: "Não Conformidades", icon: "alert" });
  }
  if (p.has(PERMISSIONS.ACTIONPLAN_MANAGE)) {
    equipamentos.push({ href: "/planos-de-acao", label: "Planos de Ação", icon: "actionPlan" });
  }
  if (equipamentos.length > 0) groups.push({ key: "equipamentos", title: "Equipamentos", items: equipamentos });

  const sst: NavItem[] = [];
  if (p.has(PERMISSIONS.CHECKLIST_EXECUTE)) {
    sst.push({ href: "/checklist/realizar", label: "Realizar Checklist", icon: "checklist" });
  }
  if (p.has(PERMISSIONS.COLLABORATOR_MANAGE) || p.has(PERMISSIONS.HR_MANAGE)) {
    sst.push({ href: "/colaboradores", label: "Colaboradores", icon: "collaborators" });
  }
  if (p.has(PERMISSIONS.ACCIDENT_MANAGE)) {
    sst.push({ href: "/acidentes", label: "Investigação de Acidentes", icon: "accidents" });
    sst.push({ href: "/acidentes/importar", label: "Importar Acidentes", icon: "qualificationImport" });
  }
  if (p.has(PERMISSIONS.ACTIVITY_MANAGE)) {
    sst.push({ href: "/atividades", label: "Atividades e Documentos", icon: "activities" });
  }
  if (p.has(PERMISSIONS.QUALIFICATION_MANAGE)) {
    sst.push({ href: "/qualificacoes", label: "Qualificações", icon: "qualifications" });
    sst.push({ href: "/qualificacoes/importar", label: "Importar ASOs/NRs", icon: "qualificationImport" });
  }
  if (sst.length > 0) groups.push({ key: "sst", title: "Segurança", items: sst });

  const rh: NavItem[] = [];
  if (p.has(PERMISSIONS.SCHEDULE_MANAGE) || user.canRollCall) {
    rh.push({ href: "/chamada", label: "Fazer Chamada", icon: "rollCall" });
  }
  if (p.has(PERMISSIONS.PRODUCTIVITY_SELF_LOG) || p.has(PERMISSIONS.PRODUCTIVITY_SELF_VIEW)) {
    rh.push({ href: "/minha-produtividade", label: "Minha Produtividade", icon: "productivity" });
  }
  if (p.has(PERMISSIONS.WARNING_SELF_VIEW)) {
    rh.push({ href: "/minhas-advertencias", label: "Minhas Advertências", icon: "alert" });
  }
  if (p.has(PERMISSIONS.SCHEDULE_SELF_VIEW)) {
    rh.push({ href: "/minha-escala", label: "Minha Escala", icon: "schedules" });
  }
  if (p.has(PERMISSIONS.HR_MANAGE)) {
    rh.push({ href: "/rh/importar", label: "Importar Planilha", icon: "hrImport" });
    rh.push({ href: "/rh/ponto", label: "Importar Ponto (AFDT)", icon: "timeClock" });
    rh.push({ href: "/pendencias-advertencia", label: "Pendências de Advertência", icon: "warningPending" });
  }
  if (p.has(PERMISSIONS.SCHEDULE_MANAGE)) {
    rh.push({ href: "/escalas", label: "Escalas de Trabalho", icon: "schedules" });
  }
  if (p.has(PERMISSIONS.HR_MANAGE)) {
    rh.push({ href: "/beneficios", label: "Benefícios", icon: "benefits" });
  }
  if (rh.length > 0) groups.push({ key: "rh", title: "RH", items: rh });

  const indicadores: NavItem[] = [];
  if (p.has(PERMISSIONS.INDICATORS_VIEW_AREA) || p.has(PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) {
    indicadores.push({ href: "/indicadores", label: "Indicadores", icon: "indicators" });
  }
  if (p.has(PERMISSIONS.HISTORY_VIEW)) {
    indicadores.push({ href: "/historico", label: "Histórico Geral", icon: "historyAll" });
  }
  if (indicadores.length > 0) groups.push({ key: "indicadores", title: "Supervisão", items: indicadores });

  const admin: NavItem[] = [];
  if (p.has(PERMISSIONS.MASTERDATA_MANAGE)) {
    admin.push({ href: "/cadastros/areas", label: "Áreas e Unidades", icon: "building" });
    admin.push({ href: "/cadastros/equipamentos", label: "Tipos de Equipamento", icon: "equipment" });
    admin.push({ href: "/cadastros/equipamentos/importar", label: "Importar Equipamentos", icon: "equipmentImport" });
    admin.push({ href: "/cadastros/modelos-checklist", label: "Modelos de Checklist", icon: "checklistTemplate" });
  }
  if (p.has(PERMISSIONS.QUALIFICATION_MANAGE)) {
    admin.push({ href: "/cadastros/qualificacoes", label: "Tipos de Qualificação", icon: "qualifications" });
  }
  if (p.has(PERMISSIONS.EPI_MANAGE)) {
    admin.push({ href: "/cadastros/tipos-epi", label: "Tipos de EPI", icon: "epi" });
    admin.push({ href: "/cadastros/funcoes", label: "Funções", icon: "jobFunctions" });
  }
  if (p.has(PERMISSIONS.SCHEDULE_MANAGE)) {
    admin.push({ href: "/cadastros/escalas", label: "Tipos de Escala", icon: "schedules" });
  }
  if (p.has(PERMISSIONS.USER_MANAGE)) {
    admin.push({ href: "/usuarios", label: "Usuários e Permissões", icon: "users" });
  }
  if (p.has(PERMISSIONS.AUDIT_VIEW)) {
    admin.push({ href: "/auditoria", label: "Auditoria", icon: "audit" });
  }
  if (admin.length > 0) groups.push({ key: "admin", title: "Administração", items: admin });

  return groups;
}
