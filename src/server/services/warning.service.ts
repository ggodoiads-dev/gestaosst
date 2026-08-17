import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

export type WarningInput = {
  collaboratorId: string;
  date: Date;
  reason: string;
};

export function listWarningsForCollaborator(user: CurrentUser, collaboratorId: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  return db.warning.findMany({ where: { collaboratorId }, orderBy: { date: "desc" } });
}

export async function createWarning(user: CurrentUser, data: WarningInput) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const warning = await db.$transaction(async (tx) => {
    const created = await tx.warning.create({ data: { ...data, createdById: user.id } });
    await recordAudit(
      { userId: user.id, action: "CREATE", entityType: "Warning", entityId: created.id, newValue: data },
      tx,
    );
    return created;
  });

  return warning;
}

export async function deleteWarning(user: CurrentUser, id: string) {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const before = await db.warning.findUniqueOrThrow({ where: { id } });
  await db.$transaction(async (tx) => {
    await tx.warning.delete({ where: { id } });
    await recordAudit(
      { userId: user.id, action: "CANCEL", entityType: "Warning", entityId: id, previousValue: before },
      tx,
    );
  });
}
