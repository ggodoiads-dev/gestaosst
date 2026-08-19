import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listChecklistBoardForUser, type ChecklistBoardEquipmentItem } from "@/server/services/checklist-execution.service";

function areaScope(user: CurrentUser, permission: string) {
  const canSeeAll = user.permissions.has(permission);
  return canSeeAll ? undefined : { in: Array.from(user.areaIds) };
}

function isEquipmentItem(item: { type: string }): item is ChecklistBoardEquipmentItem {
  return item.type === "equipamento";
}

export async function getColaboradorSummary(user: CurrentUser) {
  const board = (await listChecklistBoardForUser(user)).filter(isEquipmentItem);
  return {
    previstos: board.length,
    realizados: board.filter((b) => b.situation === "REALIZADO").length,
    pendentes: board.filter((b) => b.situation === "PENDENTE").length,
    atrasados: board.filter((b) => b.situation === "ATRASADO").length,
    emAndamento: board.filter((b) => b.situation === "EM_ANDAMENTO").length,
  };
}

export async function getGestaoSummary(user: CurrentUser) {
  const equipmentAreaFilter = areaScope(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  const ncAreaFilter = areaScope(user, PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    board,
    equipmentByStatus,
    ncAbertas,
    ncCriticas,
    ncVencidas,
    acoesVencidas,
  ] = await Promise.all([
    listChecklistBoardForUser(user).then((b) => b.filter(isEquipmentItem)),
    db.equipment.groupBy({
      by: ["status"],
      where: { active: true, areaId: equipmentAreaFilter },
      _count: true,
    }),
    db.nonconformity.count({
      where: { areaId: ncAreaFilter, status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } },
    }),
    db.nonconformity.count({
      where: { areaId: ncAreaFilter, severity: "CRITICA", status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } },
    }),
    db.nonconformity.count({
      where: {
        areaId: ncAreaFilter,
        status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] },
        dueDate: { lt: now },
      },
    }),
    db.actionItem.count({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        dueDate: { lt: now },
        actionPlan: { nonconformity: { areaId: ncAreaFilter } },
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of equipmentByStatus) statusMap[row.status] = row._count;

  return {
    previstos: board.length,
    realizados: board.filter((b) => b.situation === "REALIZADO").length,
    pendentes: board.filter((b) => b.situation === "PENDENTE").length,
    atrasados: board.filter((b) => b.situation === "ATRASADO").length,
    percentualCumprimento:
      board.length === 0 ? 100 : Math.round((board.filter((b) => b.situation === "REALIZADO").length / board.length) * 100),
    equipamentosLiberados: statusMap.LIBERADO ?? 0,
    equipamentosObservacao: statusMap.LIBERADO_COM_OBSERVACAO ?? 0,
    equipamentosRestritos: statusMap.RESTRITO ?? 0,
    equipamentosBloqueados: statusMap.BLOQUEADO ?? 0,
    equipamentosManutencao: statusMap.EM_MANUTENCAO ?? 0,
    ncAbertas,
    ncCriticas,
    ncVencidas,
    acoesVencidas,
  };
}

export async function getTopProblemEquipments(user: CurrentUser, take = 5) {
  const equipmentAreaFilter = areaScope(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);

  const grouped = await db.nonconformity.groupBy({
    by: ["equipmentId"],
    where: { equipment: { areaId: equipmentAreaFilter } },
    _count: true,
    orderBy: { _count: { equipmentId: "desc" } },
    take,
  });

  const equipmentIds = grouped.map((g) => g.equipmentId);
  const equipments = await db.equipment.findMany({ where: { id: { in: equipmentIds } } });
  const equipmentMap = new Map(equipments.map((e) => [e.id, e]));

  return grouped
    .map((g) => ({ equipment: equipmentMap.get(g.equipmentId), count: g._count }))
    .filter((g): g is { equipment: NonNullable<typeof g.equipment>; count: number } => !!g.equipment);
}

export async function getTopFaultCategories(user: CurrentUser, take = 5) {
  const ncAreaFilter = areaScope(user, PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS);

  const grouped = await db.nonconformity.groupBy({
    by: ["faultCategoryId"],
    where: { areaId: ncAreaFilter, faultCategoryId: { not: null } },
    _count: true,
    orderBy: { _count: { faultCategoryId: "desc" } },
    take,
  });

  const categoryIds = grouped.map((g) => g.faultCategoryId).filter((id): id is string => !!id);
  const categories = await db.faultCategory.findMany({ where: { id: { in: categoryIds } } });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((g) => ({ category: g.faultCategoryId ? categoryMap.get(g.faultCategoryId) : undefined, count: g._count }))
    .filter((g): g is { category: NonNullable<typeof g.category>; count: number } => !!g.category);
}

export async function getDesempenhoPorArea(user: CurrentUser) {
  const areaFilter = areaScope(user, PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  const areas = await db.area.findMany({
    where: { active: true, id: areaFilter },
    include: {
      equipments: {
        where: { active: true },
        include: {
          assignments: { where: { active: true } },
        },
      },
    },
  });

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const results = [];
  for (const area of areas) {
    const equipmentIds = area.equipments.filter((e) => e.assignments.length > 0).map((e) => e.id);
    if (equipmentIds.length === 0) continue;

    const [realizados, ncsAbertas] = await Promise.all([
      db.checklistExecution.count({
        where: { equipmentId: { in: equipmentIds }, status: "CONCLUIDO", finishedAt: { gte: startOfDay } },
      }),
      db.nonconformity.count({
        where: { equipmentId: { in: equipmentIds }, status: { notIn: ["CONCLUIDA", "ENCERRADA", "CANCELADA"] } },
      }),
    ]);

    results.push({
      areaId: area.id,
      areaName: area.name,
      totalEquipamentos: equipmentIds.length,
      realizadosHoje: realizados,
      ncsAbertas,
    });
  }

  return results;
}
