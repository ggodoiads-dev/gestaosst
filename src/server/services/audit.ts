import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "STATUS_CHANGE"
  | "BLOCK"
  | "RELEASE"
  | "CANCEL"
  | "INVALIDATE"
  | "TRANSFER_AREA"
  | "CHANGE_DUE_DATE"
  | "CHANGE_RESPONSIBLE"
  | "LOGIN"
  | "PUBLISH_VERSION";

/** Registra uma entrada no log de auditoria (seção 43 do documento). */
export async function recordAudit(
  params: {
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    previousValue?: unknown;
    newValue?: unknown;
  },
  tx: Tx = db,
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValue:
        params.previousValue !== undefined ? JSON.stringify(params.previousValue) : null,
      newValue: params.newValue !== undefined ? JSON.stringify(params.newValue) : null,
    },
  });
}
