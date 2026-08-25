/**
 * Catálogo central de permissões (seção 5/9 do documento: perfis e permissões
 * devem ser extensíveis sem reescrever o sistema). As permissões são strings
 * persistidas no banco (tabela Permission) e vinculadas a perfis via
 * RolePermission — checagens no código sempre usam estas chaves, nunca o
 * nome do perfil diretamente, para permitir novos perfis no futuro.
 */
export const PERMISSIONS = {
  EQUIPMENT_VIEW: "equipment.view",
  EQUIPMENT_VIEW_ALL_AREAS: "equipment.view_all_areas",
  EQUIPMENT_MANAGE: "equipment.manage",
  EQUIPMENT_TRANSFER: "equipment.transfer",
  EQUIPMENT_MAINTENANCE: "equipment.maintenance",

  CHECKLIST_EXECUTE: "checklist.execute",
  CHECKLIST_TEMPLATE_MANAGE: "checklist_template.manage",
  CHECKLIST_VIEW_TEAM: "checklist.view_team",
  CHECKLIST_INVALIDATE: "checklist.invalidate",
  CHECKLIST_COMPLIANCE_VIEW: "checklist.compliance_view",

  NONCONFORMITY_VIEW: "nonconformity.view",
  NONCONFORMITY_VIEW_ALL_AREAS: "nonconformity.view_all_areas",
  NONCONFORMITY_TREAT: "nonconformity.treat",

  ACTIONPLAN_MANAGE: "actionplan.manage",
  ACTIONITEM_VALIDATE: "actionitem.validate",

  INDICATORS_VIEW_AREA: "indicators.view_area",
  INDICATORS_VIEW_CONSOLIDATED: "indicators.view_consolidated",

  HISTORY_VIEW: "history.view",
  AUDIT_VIEW: "audit.view",

  USER_MANAGE: "user.manage",
  MASTERDATA_MANAGE: "masterdata.manage",

  COLLABORATOR_MANAGE: "collaborator.manage",
  ACCIDENT_MANAGE: "accident.manage",
  EQUIPMENT_DAMAGE_MANAGE: "equipment_damage.manage",
  GUARDIAN_MANAGE: "guardian.manage",
  QUALIFICATION_MANAGE: "qualification.manage",
  EPI_MANAGE: "epi.manage",
  ACTIVITY_MANAGE: "activity.manage",
  SCHEDULE_MANAGE: "schedule.manage",
  SCHEDULE_SELF_VIEW: "schedule.self_view",
  PRODUCTIVITY_MANAGE: "productivity.manage",
  PRODUCTIVITY_MANAGE_TEAM: "productivity.manage_team",
  PRODUCTIVITY_SELF_LOG: "productivity.self_log",
  PRODUCTIVITY_SELF_VIEW: "productivity.self_view",
  SHIFT_CHECKIN_SELF: "shift.checkin_self",
  SHIFT_CHECKIN_MANAGE: "shift.checkin_manage",
  REPORTS_VIEW: "reports.view",
  WARNING_SELF_VIEW: "warning.self_view",

  HR_MANAGE: "hr.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.EQUIPMENT_VIEW]: "Visualizar equipamentos das áreas permitidas",
  [PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS]: "Visualizar equipamentos de todas as áreas",
  [PERMISSIONS.EQUIPMENT_MANAGE]: "Cadastrar e alterar equipamentos",
  [PERMISSIONS.EQUIPMENT_TRANSFER]: "Transferir equipamentos entre áreas",
  [PERMISSIONS.EQUIPMENT_MAINTENANCE]: "Colocar e concluir manutenção de equipamentos",

  [PERMISSIONS.CHECKLIST_EXECUTE]: "Realizar checklists",
  [PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE]: "Criar e versionar modelos de checklist",
  [PERMISSIONS.CHECKLIST_VIEW_TEAM]: "Visualizar checklists da equipe/área",
  [PERMISSIONS.CHECKLIST_INVALIDATE]: "Invalidar checklists realizados",
  [PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW]: "Ver quem cumpriu o checklist do turno, por colaborador",

  [PERMISSIONS.NONCONFORMITY_VIEW]: "Visualizar não conformidades das áreas permitidas",
  [PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS]: "Visualizar não conformidades de todas as áreas",
  [PERMISSIONS.NONCONFORMITY_TREAT]: "Tratar não conformidades",

  [PERMISSIONS.ACTIONPLAN_MANAGE]: "Criar e acompanhar planos de ação",
  [PERMISSIONS.ACTIONITEM_VALIDATE]: "Validar correções e liberar equipamentos",

  [PERMISSIONS.INDICATORS_VIEW_AREA]: "Visualizar indicadores da própria área",
  [PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED]: "Visualizar indicadores consolidados",

  [PERMISSIONS.HISTORY_VIEW]: "Consultar histórico completo",
  [PERMISSIONS.AUDIT_VIEW]: "Consultar log de auditoria",

  [PERMISSIONS.USER_MANAGE]: "Administrar usuários e permissões",
  [PERMISSIONS.MASTERDATA_MANAGE]: "Administrar unidades, áreas, tipos e modelos",

  [PERMISSIONS.COLLABORATOR_MANAGE]: "Cadastrar e alterar colaboradores",
  [PERMISSIONS.ACCIDENT_MANAGE]: "Registrar e tratar acidentes/incidentes",
  [PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE]: "Registrar e tratar avarias em equipamentos (frota)",
  [PERMISSIONS.GUARDIAN_MANAGE]: "Importar e consultar relatos do Guardian",
  [PERMISSIONS.QUALIFICATION_MANAGE]: "Gerenciar treinamentos, NRs, ASOs e integrações",
  [PERMISSIONS.EPI_MANAGE]: "Gerenciar funções, tipos de EPI e fichas de entrega dos colaboradores",
  [PERMISSIONS.ACTIVITY_MANAGE]: "Gerenciar atividades e documentos (POP/AR-VR)",
  [PERMISSIONS.SCHEDULE_MANAGE]: "Gerenciar escalas de trabalho dos colaboradores",
  [PERMISSIONS.SCHEDULE_SELF_VIEW]: "Ver a própria escala de trabalho",
  [PERMISSIONS.PRODUCTIVITY_MANAGE]: "Lançar e consultar produtividade de todos os colaboradores",
  [PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM]: "Lançar e consultar produtividade dos colaboradores das áreas/turnos em que faz chamada",
  [PERMISSIONS.PRODUCTIVITY_SELF_LOG]: "Lançar a própria produtividade",
  [PERMISSIONS.PRODUCTIVITY_SELF_VIEW]: "Ver a própria produtividade",
  [PERMISSIONS.SHIFT_CHECKIN_SELF]: "Confirmar a própria presença no turno",
  [PERMISSIONS.SHIFT_CHECKIN_MANAGE]: "Confirmar presença de qualquer colaborador (quando ele esquece)",
  [PERMISSIONS.REPORTS_VIEW]: "Gerar e baixar relatórios",
  [PERMISSIONS.WARNING_SELF_VIEW]: "Ver as próprias advertências",

  [PERMISSIONS.HR_MANAGE]: "Acessar dados de RH (salário) e importar planilha de colaboradores",
};

export const ROLE_KEYS = {
  COLABORADOR: "COLABORADOR",
  LIDER_SUPERVISOR: "LIDER_SUPERVISOR",
  GESTOR: "GESTOR",
  ADMINISTRADOR: "ADMINISTRADOR",
} as const;

export type RoleKeyValue = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const ROLE_LABELS: Record<RoleKeyValue, string> = {
  COLABORADOR: "Colaborador",
  LIDER_SUPERVISOR: "Líder / Supervisor",
  GESTOR: "Gestor",
  ADMINISTRADOR: "Administrador",
};

/** Permissões padrão de cada perfil ao criar a base (seções 6-9). */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKeyValue, PermissionKey[]> = {
  COLABORADOR: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.SHIFT_CHECKIN_SELF,
    PERMISSIONS.WARNING_SELF_VIEW,
    PERMISSIONS.SCHEDULE_SELF_VIEW,
    PERMISSIONS.PRODUCTIVITY_SELF_VIEW,
  ],
  LIDER_SUPERVISOR: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_MAINTENANCE,
    PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.CHECKLIST_VIEW_TEAM,
    PERMISSIONS.NONCONFORMITY_VIEW,
    PERMISSIONS.NONCONFORMITY_TREAT,
    PERMISSIONS.ACTIONPLAN_MANAGE,
    PERMISSIONS.ACTIONITEM_VALIDATE,
    PERMISSIONS.INDICATORS_VIEW_AREA,
    PERMISSIONS.PRODUCTIVITY_MANAGE_TEAM,
  ],
  GESTOR: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS,
    PERMISSIONS.EQUIPMENT_MAINTENANCE,
    PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE,
    PERMISSIONS.CHECKLIST_EXECUTE,
    PERMISSIONS.CHECKLIST_VIEW_TEAM,
    PERMISSIONS.NONCONFORMITY_VIEW,
    PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS,
    PERMISSIONS.NONCONFORMITY_TREAT,
    PERMISSIONS.ACTIONPLAN_MANAGE,
    PERMISSIONS.ACTIONITEM_VALIDATE,
    PERMISSIONS.INDICATORS_VIEW_AREA,
    PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED,
    PERMISSIONS.HISTORY_VIEW,
    PERMISSIONS.COLLABORATOR_MANAGE,
    PERMISSIONS.ACCIDENT_MANAGE,
    PERMISSIONS.QUALIFICATION_MANAGE,
    PERMISSIONS.GUARDIAN_MANAGE,
    PERMISSIONS.EPI_MANAGE,
    PERMISSIONS.ACTIVITY_MANAGE,
    PERMISSIONS.SCHEDULE_MANAGE,
    PERMISSIONS.PRODUCTIVITY_MANAGE,
    PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW,
    PERMISSIONS.SHIFT_CHECKIN_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  ADMINISTRADOR: Object.values(PERMISSIONS),
};
