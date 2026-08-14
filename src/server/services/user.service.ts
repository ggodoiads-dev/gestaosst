import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { hashPassword } from "@/server/auth/passwords";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export function listUsers() {
  return db.user.findMany({
    include: { role: true, unit: true, userAreas: { include: { area: true } } },
    orderBy: { name: "asc" },
  });
}

export function listActiveUsers() {
  return db.user.findMany({
    where: { active: true },
    include: { role: true },
    orderBy: { name: "asc" },
  });
}

export function listRoles() {
  return db.role.findMany({ orderBy: { name: "asc" } });
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  unitId?: string | null;
  areaIds: string[];
};

/**
 * Cria o registro de usuário sem checar permissão — uso interno, para chamadores que já
 * validaram a própria permissão (ex: provisionamento automático a partir de um colaborador,
 * que exige `COLLABORATOR_MANAGE` em vez de `USER_MANAGE`). Não chamar diretamente a partir de
 * uma action/rota; use `createUser` (com permissão) ou o serviço específico do domínio.
 */
export async function createUserRecord(actorId: string, data: CreateUserInput) {
  const passwordHash = await hashPassword(data.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: data.name,
        email: data.email.trim().toLowerCase(),
        passwordHash,
        roleId: data.roleId,
        unitId: data.unitId || null,
      },
    });
    if (data.areaIds.length > 0) {
      await tx.userArea.createMany({
        data: data.areaIds.map((areaId) => ({ userId: created.id, areaId })),
      });
    }
    return created;
  });

  await recordAudit({
    userId: actorId,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    newValue: { name: data.name, email: data.email, roleId: data.roleId },
  });

  return user;
}

export async function createUser(admin: CurrentUser, data: CreateUserInput) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  return createUserRecord(admin.id, data);
}

export type UpdateUserInput = {
  name: string;
  email: string;
  roleId: string;
  unitId?: string | null;
  areaIds: string[];
};

export async function setUserActive(admin: CurrentUser, id: string, active: boolean) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  if (!active && id === admin.id) {
    throw new ForbiddenError("Você não pode excluir seu próprio usuário.");
  }
  const before = await db.user.findUniqueOrThrow({ where: { id } });
  const user = await db.user.update({ where: { id }, data: { active } });
  await recordAudit({
    userId: admin.id,
    action: active ? "UPDATE" : "CANCEL",
    entityType: "User",
    entityId: id,
    previousValue: { active: before.active },
    newValue: { active },
  });
  return user;
}

export async function updateUser(admin: CurrentUser, id: string, data: UpdateUserInput) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  const before = await db.user.findUniqueOrThrow({ where: { id } });

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email.trim().toLowerCase(),
        roleId: data.roleId,
        unitId: data.unitId || null,
      },
    });
    await tx.userArea.deleteMany({ where: { userId: id } });
    if (data.areaIds.length > 0) {
      await tx.userArea.createMany({ data: data.areaIds.map((areaId) => ({ userId: id, areaId })) });
    }
    return updated;
  });

  await recordAudit({
    userId: admin.id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    previousValue: { name: before.name, email: before.email, roleId: before.roleId },
    newValue: { name: data.name, email: data.email, roleId: data.roleId },
  });

  return user;
}

/** Uso interno, sem checagem de permissão — ver `createUserRecord`. */
export async function resetUserPasswordRecord(actorId: string, id: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id }, data: { passwordHash } });
  await recordAudit({ userId: actorId, action: "UPDATE", entityType: "User", entityId: id, newValue: { passwordReset: true } });
}

export async function resetUserPassword(admin: CurrentUser, id: string, newPassword: string) {
  requirePermission(admin, PERMISSIONS.USER_MANAGE);
  return resetUserPasswordRecord(admin.id, id, newPassword);
}
