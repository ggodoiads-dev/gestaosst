import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth/session";
import {
  hasPermission,
  requirePermission,
  requireAreaAccess,
  ForbiddenError,
  UnauthorizedError,
  type CurrentUser,
} from "@/domain/shared/access-control";

export type { CurrentUser } from "@/domain/shared/access-control";
export { hasPermission, requirePermission, requireAreaAccess, ForbiddenError, UnauthorizedError };

/** Carrega o usuário autenticado (com perfil, permissões e áreas) uma única vez por requisição. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      userAreas: true,
      userFunctions: true,
      userRollCallAreas: true,
      userRollCallTurnos: true,
    },
  });

  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleName: user.role.name,
    unitId: user.unitId,
    permissions: new Set(user.role.rolePermissions.map((rp) => rp.permission.key)),
    areaIds: new Set(user.userAreas.map((ua) => ua.areaId)),
    functionIds: new Set(user.userFunctions.map((uf) => uf.functionId)),
    canRollCall: user.canRollCall,
    rollCallAreaIds: new Set(user.userRollCallAreas.map((a) => a.areaId)),
    rollCallTurnoIds: new Set(user.userRollCallTurnos.map((t) => t.turnoId)),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // `?sessao=expirada` avisa o proxy que a sessão deixou de valer (ex: usuário desativado) mesmo que o
  // cache de "usuário ativo" dele ainda diga o contrário — senão os dois se mandariam de um pro outro.
  if (!user) redirect("/login?sessao=expirada");
  return user;
}
