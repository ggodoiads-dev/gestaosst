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
  | "jobFunctions";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export function getNavGroups(user: CurrentUser): NavGroup[] {
  const p = user.permissions;
  const groups: NavGroup[] = [];

  const principal: NavItem[] = [{ href: "/inicio", label: "Início", icon: "dashboard" }];
  if (p.has(PERMISSIONS.CHECKLIST_EXECUTE)) {
    principal.push({ href: "/checklist/realizar", label: "Realizar Checklist", icon: "checklist" });
  }
  if (p.has(PERMISSIONS.PRODUCTIVITY_SELF_LOG)) {
    principal.push({ href: "/minha-produtividade", label: "Minha Produtividade", icon: "productivity" });
  }
  if (p.has(PERMISSIONS.SHIFT_CHECKIN_SELF)) {
    principal.push({ href: "/minha-presenca", label: "Minha Presença", icon: "myPresence" });
  }
  if (p.has(PERMISSIONS.EQUIPMENT_VIEW)) {
    principal.push({ href: "/equipamentos", label: "Equipamentos", icon: "equipment" });
  }
  groups.push({ items: principal });

  const gestao: NavItem[] = [];
  if (p.has(PERMISSIONS.EQUIPMENT_MAINTENANCE)) {
    gestao.push({ href: "/manutencao", label: "Manutenção", icon: "maintenance" });
  }
  if (p.has(PERMISSIONS.NONCONFORMITY_VIEW)) {
    gestao.push({ href: "/nao-conformidades", label: "Não Conformidades", icon: "alert" });
  }
  if (p.has(PERMISSIONS.ACTIONPLAN_MANAGE)) {
    gestao.push({ href: "/planos-de-acao", label: "Planos de Ação", icon: "actionPlan" });
  }
  gestao.push({ href: "/meu-historico", label: "Meu Histórico", icon: "history" });
  if (p.has(PERMISSIONS.HISTORY_VIEW)) {
    gestao.push({ href: "/historico", label: "Histórico Geral", icon: "historyAll" });
  }
  if (p.has(PERMISSIONS.INDICATORS_VIEW_AREA) || p.has(PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) {
    gestao.push({ href: "/indicadores", label: "Indicadores", icon: "indicators" });
  }
  if (p.has(PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW)) {
    gestao.push({ href: "/checklist/conformidade", label: "Conformidade de Checklist", icon: "checklistCompliance" });
  }
  if (gestao.length > 0) groups.push({ title: "Gestão", items: gestao });

  const sst: NavItem[] = [];
  if (p.has(PERMISSIONS.COLLABORATOR_MANAGE)) {
    sst.push({ href: "/colaboradores", label: "Colaboradores", icon: "collaborators" });
  }
  if (p.has(PERMISSIONS.ACCIDENT_MANAGE)) {
    sst.push({ href: "/acidentes", label: "Investigação de Acidentes", icon: "accidents" });
  }
  if (p.has(PERMISSIONS.ACTIVITY_MANAGE)) {
    sst.push({ href: "/atividades", label: "Atividades e Documentos", icon: "activities" });
  }
  if (p.has(PERMISSIONS.QUALIFICATION_MANAGE)) {
    sst.push({ href: "/qualificacoes", label: "Qualificações", icon: "qualifications" });
  }
  if (p.has(PERMISSIONS.SCHEDULE_MANAGE)) {
    sst.push({ href: "/escalas", label: "Escalas de Trabalho", icon: "schedules" });
  }
  if (p.has(PERMISSIONS.PRODUCTIVITY_MANAGE)) {
    sst.push({ href: "/produtividade", label: "Produtividade", icon: "productivity" });
  }
  if (sst.length > 0) groups.push({ title: "SST", items: sst });

  const admin: NavItem[] = [];
  if (p.has(PERMISSIONS.MASTERDATA_MANAGE)) {
    admin.push({ href: "/cadastros/areas", label: "Áreas e Unidades", icon: "building" });
    admin.push({ href: "/cadastros/equipamentos", label: "Tipos de Equipamento", icon: "equipment" });
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
  if (admin.length > 0) groups.push({ title: "Administração", items: admin });

  return groups;
}
