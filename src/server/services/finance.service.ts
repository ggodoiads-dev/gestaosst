import "server-only";
import { db } from "@/server/db";
import { hasPermission, type CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getEquipmentDamageCostSummary, type EquipmentDamageCostSummary } from "@/server/services/equipment-damage.service";

export type PayrollSummary = {
  totalMonthly: number;
  collaboratorsWithSalary: number;
  collaboratorsWithoutSalary: number;
};

async function getPayrollSummary(): Promise<PayrollSummary> {
  const collaborators = await db.collaborator.findMany({
    where: { active: true },
    select: { salary: true },
  });

  let totalMonthly = 0;
  let collaboratorsWithSalary = 0;
  for (const c of collaborators) {
    if (c.salary) {
      totalMonthly += Number(c.salary);
      collaboratorsWithSalary++;
    }
  }

  return {
    totalMonthly,
    collaboratorsWithSalary,
    collaboratorsWithoutSalary: collaborators.length - collaboratorsWithSalary,
  };
}

export type FinanceSummary = {
  damageCost: EquipmentDamageCostSummary | null;
  payroll: PayrollSummary | null;
};

/**
 * Painel Financeiro: consolida custo já conhecido pelo sistema — avarias de frota (período) e
 * folha de pagamento (salário dos colaboradores ativos, foto atual). Cada seção só entra se o
 * usuário tem a permissão daquele domínio, mesmo critério do sino de alertas.
 */
export async function getFinanceSummary(user: CurrentUser, damageRange: { from: Date; to: Date }): Promise<FinanceSummary> {
  const hasDamageAccess = hasPermission(user, PERMISSIONS.EQUIPMENT_DAMAGE_MANAGE);
  const hasPayrollAccess = hasPermission(user, PERMISSIONS.HR_MANAGE);

  const [damageCost, payroll] = await Promise.all([
    hasDamageAccess ? getEquipmentDamageCostSummary(user, damageRange) : Promise.resolve(null),
    hasPayrollAccess ? getPayrollSummary() : Promise.resolve(null),
  ]);

  return { damageCost, payroll };
}
