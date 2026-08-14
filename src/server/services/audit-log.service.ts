import "server-only";
import { db } from "@/server/db";

export function listAuditLogs(filters: { entityType?: string; action?: string } = {}, take = 200) {
  return db.auditLog.findMany({
    where: {
      entityType: filters.entityType || undefined,
      action: filters.action || undefined,
    },
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    take,
  });
}
