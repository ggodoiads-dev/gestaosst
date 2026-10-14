import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "fa084faba1e84ac9198079686e4f5f2cc3c7dab7a339351321c2d6b54e790963";

// Migração fixa (mesmo SQL de prisma/migrations/20261015120000_add_login_attempt), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "emailKey" TEXT NOT NULL,
    "ipHash" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "LoginAttempt_emailKey_createdAt_idx" ON "LoginAttempt"("emailKey", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt")`,
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);
  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "LoginAttempt"`);
  return NextResponse.json({ ok: true, table: "LoginAttempt", rows: Number(rows[0].count) });
}
