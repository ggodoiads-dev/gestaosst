import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import type { Criticality } from "@/generated/prisma/enums";

const WINDOW_DAYS = 90;
const CLOSED_NC_STATUSES = ["CONCLUIDA", "ENCERRADA", "CANCELADA"];

/**
 * Pesos da heurística de risco do Copiloto de Inspeção — deliberadamente uma fórmula
 * simples e auditável (não é modelo treinado), pra nunca virar "caixa preta" numa
 * ferramenta de segurança. Ajustar aqui muda o cálculo pro sistema inteiro.
 */
export const RISK_WEIGHTS = {
  severityPoints: { BAIXA: 1, MEDIA: 2, ALTA: 4, CRITICA: 8 } as Record<Criticality, number>,
  ncOpenBonus: 5,
  ncOverdueBonus: 10,
  accidentBonus: 6,
  normalizationFactor: 2,
};

function areaScope(user: CurrentUser, permission: string) {
  const canSeeAll = user.permissions.has(permission);
  return canSeeAll ? undefined : { in: Array.from(user.areaIds) };
}

export type EquipmentRisk = {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  areaId: string;
  areaName: string;
  score: number;
  latestAiFinding: { severity: Criticality; summary: string } | null;
};

async function computeRanking(user: CurrentUser): Promise<EquipmentRisk[]> {
  const areaFilter = areaScope(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const equipments = await db.equipment.findMany({
    where: { active: true, areaId: areaFilter },
    include: { area: true },
  });
  if (equipments.length === 0) return [];

  const equipmentIds = equipments.map((e) => e.id);
  const areaIds = [...new Set(equipments.map((e) => e.areaId))];

  const [nonconformities, accidents, findings] = await Promise.all([
    db.nonconformity.findMany({
      where: { equipmentId: { in: equipmentIds }, identifiedAt: { gte: since } },
      select: { equipmentId: true, severity: true, status: true, dueDate: true },
    }),
    db.accident.findMany({
      where: { areaId: { in: areaIds }, date: { gte: since } },
      select: { areaId: true },
    }),
    db.aiInspectionFinding.findMany({
      where: { createdAt: { gte: since } },
      select: {
        severity: true,
        summary: true,
        createdAt: true,
        attachment: {
          select: { checklistAnswer: { select: { execution: { select: { equipmentId: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pointsByEquipment = new Map<string, number>();
  const addPoints = (equipmentId: string, points: number) =>
    pointsByEquipment.set(equipmentId, (pointsByEquipment.get(equipmentId) ?? 0) + points);

  for (const nc of nonconformities) {
    let points = RISK_WEIGHTS.severityPoints[nc.severity];
    const isOpen = !CLOSED_NC_STATUSES.includes(nc.status);
    if (isOpen) points += RISK_WEIGHTS.ncOpenBonus;
    if (isOpen && nc.dueDate && nc.dueDate < now) points += RISK_WEIGHTS.ncOverdueBonus;
    addPoints(nc.equipmentId, points);
  }

  const accidentPointsByArea = new Map<string, number>();
  for (const accident of accidents) {
    if (!accident.areaId) continue;
    accidentPointsByArea.set(
      accident.areaId,
      (accidentPointsByArea.get(accident.areaId) ?? 0) + RISK_WEIGHTS.accidentBonus,
    );
  }

  const latestFindingByEquipment = new Map<string, { severity: Criticality; summary: string; createdAt: Date }>();
  for (const finding of findings) {
    const equipmentId = finding.attachment.checklistAnswer?.execution?.equipmentId;
    if (!equipmentId) continue;
    addPoints(equipmentId, RISK_WEIGHTS.severityPoints[finding.severity]);
    const existing = latestFindingByEquipment.get(equipmentId);
    if (!existing || finding.createdAt > existing.createdAt) {
      latestFindingByEquipment.set(equipmentId, finding);
    }
  }

  const ranking: EquipmentRisk[] = equipments.map((equipment) => {
    const points = (pointsByEquipment.get(equipment.id) ?? 0) + (accidentPointsByArea.get(equipment.areaId) ?? 0);
    const score = Math.min(100, Math.round(points * RISK_WEIGHTS.normalizationFactor));
    const finding = latestFindingByEquipment.get(equipment.id);
    return {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      areaId: equipment.areaId,
      areaName: equipment.area.name,
      score,
      latestAiFinding: finding ? { severity: finding.severity, summary: finding.summary } : null,
    };
  });

  return ranking.sort((a, b) => b.score - a.score);
}

/** Equipamentos de maior risco, visíveis ao usuário — pro Painel de Risco em /indicadores. */
export async function getEquipmentRiskRanking(user: CurrentUser, take = 10): Promise<EquipmentRisk[]> {
  const ranking = await computeRanking(user);
  return ranking.slice(0, take);
}

export type AreaRiskSummary = { areaId: string; areaName: string; averageScore: number };

/** Score de risco médio por área (rollup dos equipamentos daquela área). */
export async function getAreaRiskSummary(user: CurrentUser): Promise<AreaRiskSummary[]> {
  const ranking = await computeRanking(user);

  const byArea = new Map<string, { areaName: string; total: number; count: number }>();
  for (const item of ranking) {
    const entry = byArea.get(item.areaId) ?? { areaName: item.areaName, total: 0, count: 0 };
    entry.total += item.score;
    entry.count += 1;
    byArea.set(item.areaId, entry);
  }

  return Array.from(byArea.entries())
    .map(([areaId, entry]) => ({
      areaId,
      areaName: entry.areaName,
      averageScore: Math.round(entry.total / entry.count),
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}
