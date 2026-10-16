import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getAreaPublicOverview } from "@/server/services/masterdata.service";

/** Áreas — SÓ LEITURA (mesmo padrão da lista de Equipamentos): quem tem acesso a equipamentos vê as áreas dele (todas, se tem
 * "ver todas as áreas"). Criar, editar e excluir áreas continua exclusivo do cadastro (Administração). */
function areaScope(user: CurrentUser) {
  requirePermission(user, PERMISSIONS.EQUIPMENT_VIEW);
  return user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS) ? undefined : Array.from(user.areaIds);
}

export async function listAreasForUser(user: CurrentUser, filters: { search?: string } = {}) {
  const allowed = areaScope(user);
  const search = filters.search?.trim();
  const areas = await db.area.findMany({
    where: {
      active: true,
      ...(allowed ? { id: { in: allowed } } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }, { sector: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    include: {
      unit: { select: { name: true } },
      _count: { select: { equipments: { where: { active: true } }, collaborators: { where: { active: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return areas.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    sector: a.sector,
    unitName: a.unit.name,
    equipmentCount: a._count.equipments,
    collaboratorCount: a._count.collaborators,
    hasQrCode: !!a.qrToken,
  }));
}

export async function getAreaForView(user: CurrentUser, id: string) {
  const allowed = areaScope(user);
  if (allowed && !allowed.includes(id)) throw new ForbiddenError();

  const area = await db.area.findUnique({
    where: { id },
    include: {
      unit: { select: { name: true } },
      equipments: {
        where: { active: true },
        select: { id: true, code: true, name: true, status: true, type: { select: { name: true } } },
        orderBy: { code: "asc" },
      },
      _count: { select: { collaborators: { where: { active: true } } } },
    },
  });
  if (!area) return null;
  const documents = await getAreaPublicOverview({ id: area.id, name: area.name });
  return { area, collaboratorCount: area._count.collaborators, documents };
}
