import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export async function globalSearch(user: CurrentUser, query: string) {
  if (!query.trim()) return { equipments: [], nonconformities: [] };

  const canSeeAllEquipment = user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS);
  const canSeeAllNc = user.permissions.has(PERMISSIONS.NONCONFORMITY_VIEW_ALL_AREAS);

  const [equipments, nonconformities] = await Promise.all([
    user.permissions.has(PERMISSIONS.EQUIPMENT_VIEW)
      ? db.equipment.findMany({
          where: {
            areaId: canSeeAllEquipment ? undefined : { in: Array.from(user.areaIds) },
            OR: [
              { code: { contains: query } },
              { name: { contains: query } },
              { assetTag: { contains: query } },
            ],
          },
          include: { area: true, type: true },
          take: 20,
        })
      : [],
    user.permissions.has(PERMISSIONS.NONCONFORMITY_VIEW)
      ? db.nonconformity.findMany({
          where: {
            areaId: canSeeAllNc ? undefined : { in: Array.from(user.areaIds) },
            code: { contains: query },
          },
          include: { equipment: true },
          take: 20,
        })
      : [],
  ]);

  return { equipments, nonconformities };
}
