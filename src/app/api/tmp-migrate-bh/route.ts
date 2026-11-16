import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "e9fb4ff556f3daef165cc3de1d6c6c2c3a6844a4e4181452dff7f1651e20bf01";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "BankHourEntry" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "holidayName" TEXT,
    "note" TEXT,
    "dedupKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankHourEntry_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "BankHourEntry_dedupKey_key" ON "BankHourEntry"("dedupKey");`,
  `CREATE INDEX IF NOT EXISTS "BankHourEntry_collaboratorId_idx" ON "BankHourEntry"("collaboratorId");`,
  `CREATE INDEX IF NOT EXISTS "BankHourEntry_date_idx" ON "BankHourEntry"("date");`,
];

// Escopo fechado: cria a tabela BankHourEntry (lancamentos do banco de horas) e os indices, se ainda nao existirem. Idempotente. Nada mais.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const results: string[] = [];
  for (const sql of STATEMENTS) {
    try {
      const affected = await db.$executeRawUnsafe(sql);
      results.push(`ok (${affected})`);
    } catch (error) {
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }
  return NextResponse.json({ ok: true, statements: results });
}
