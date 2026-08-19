import type { PermissionKey } from "@/domain/shared/permissions";

/**
 * Lógica pura de controle de acesso, sem dependências de Next.js/React, para
 * poder ser testada isoladamente (seção 63 do documento: testes de
 * permissões e acesso por área).
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: string;
  roleKey: string;
  roleName: string;
  unitId: string | null;
  permissions: Set<string>;
  areaIds: Set<string>;
  functionIds: Set<string>;
  canRollCall: boolean;
  rollCallAreaIds: Set<string>;
  rollCallTurnoIds: Set<string>;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("Usuário não autenticado.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Você não tem permissão para executar esta ação.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasPermission(user: CurrentUser, permission: PermissionKey): boolean {
  return user.permissions.has(permission);
}

export function requirePermission(user: CurrentUser, permission: PermissionKey): void {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError();
  }
}

/** Garante que o usuário tem acesso à área informada (ou a permissão que libera todas as áreas). */
export function requireAreaAccess(
  user: CurrentUser,
  areaId: string,
  allAreasPermission: PermissionKey,
): void {
  if (hasPermission(user, allAreasPermission)) return;
  if (user.areaIds.has(areaId)) return;
  throw new ForbiddenError("Você não tem acesso a esta área.");
}
