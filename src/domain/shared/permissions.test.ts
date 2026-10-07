import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS } from "./permissions";

describe("perfil Auditor (só leitura)", () => {
  const auditor = DEFAULT_ROLE_PERMISSIONS[ROLE_KEYS.AUDITOR];

  it("só tem permissões de visualização — nunca gerenciar, tratar, validar, executar ou RH", () => {
    const forbidden = [
      PERMISSIONS.HR_MANAGE,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.MASTERDATA_MANAGE,
      PERMISSIONS.COLLABORATOR_MANAGE,
      PERMISSIONS.EQUIPMENT_MANAGE,
      PERMISSIONS.EQUIPMENT_TRANSFER,
      PERMISSIONS.EQUIPMENT_MAINTENANCE,
      PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE,
      PERMISSIONS.CHECKLIST_EXECUTE,
      PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE,
      PERMISSIONS.CHECKLIST_INVALIDATE,
      PERMISSIONS.NONCONFORMITY_TREAT,
      PERMISSIONS.ACTIONPLAN_MANAGE,
      PERMISSIONS.ACTIONITEM_VALIDATE,
      PERMISSIONS.GUARDIAN_MANAGE,
      PERMISSIONS.SCHEDULE_MANAGE,
      PERMISSIONS.PRODUCTIVITY_MANAGE,
      PERMISSIONS.SHIFT_CHECKIN_MANAGE,
      PERMISSIONS.ACCIDENT_MANAGE,
      PERMISSIONS.QUALIFICATION_MANAGE,
      PERMISSIONS.EPI_MANAGE,
      PERMISSIONS.ACTIVITY_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
    ];
    for (const key of forbidden) expect(auditor).not.toContain(key);
  });

  it("enxerga o que foi combinado: indicadores, equipamentos, NCs, planos, Guardian, checklist e presença", () => {
    for (const key of [
      PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED,
      PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS,
      PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS,
      PERMISSIONS.ACTIONPLAN_VIEW,
      PERMISSIONS.GUARDIAN_VIEW,
      PERMISSIONS.CHECKLIST_COMPLIANCE_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
    ]) {
      expect(auditor).toContain(key);
    }
  });

  it("todas as permissões do Auditor existem no catálogo e o administrador recebe todas", () => {
    for (const key of auditor) expect(PERMISSION_DESCRIPTIONS[key]).toBeTruthy();
    expect(DEFAULT_ROLE_PERMISSIONS[ROLE_KEYS.ADMINISTRADOR]).toEqual(expect.arrayContaining(auditor));
  });
});
