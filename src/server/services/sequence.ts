import "server-only";
import { db } from "@/server/db";
import { formatFriendlyCode } from "@/domain/shared/codes";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Incrementa e retorna o próximo valor de uma sequência nomeada, de forma atômica. */
export async function nextSequenceValue(key: string, tx: Tx = db): Promise<number> {
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export async function nextFriendlyCode(
  key: string,
  prefix: string,
  digits = 6,
  tx: Tx = db,
): Promise<string> {
  const value = await nextSequenceValue(key, tx);
  return formatFriendlyCode(prefix, value, digits);
}
