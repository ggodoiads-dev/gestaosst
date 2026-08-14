import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { EquipmentEventType } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

/** Registra um evento na linha do tempo do equipamento (seção 38 do documento). */
export async function recordEquipmentEvent(
  params: {
    equipmentId: string;
    type: EquipmentEventType;
    description: string;
    userId?: string | null;
    executionId?: string | null;
    nonconformityId?: string | null;
    actionItemId?: string | null;
  },
  tx: Tx = db,
) {
  await tx.equipmentEvent.create({
    data: {
      equipmentId: params.equipmentId,
      type: params.type,
      description: params.description,
      userId: params.userId ?? null,
      executionId: params.executionId ?? null,
      nonconformityId: params.nonconformityId ?? null,
      actionItemId: params.actionItemId ?? null,
    },
  });
}
