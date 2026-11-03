import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "6b4018ecb53212fb92f99e9b04d1ef60e4beb9866f4560e6cb0a2988afe9630c";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ExitInterview" (
    "id" TEXT NOT NULL,
    "terminationId" TEXT NOT NULL,
    "conductedAt" TIMESTAMP(3) NOT NULL,
    "interviewer" TEXT,
    "primaryReason" TEXT NOT NULL,
    "secondaryReasons" JSONB NOT NULL DEFAULT '[]',
    "ratings" JSONB NOT NULL DEFAULT '{}',
    "wouldReturn" TEXT,
    "destination" TEXT,
    "comments" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExitInterview_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE IF NOT EXISTS "TurnoverHeadcount" (
    "month" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnoverHeadcount_pkey" PRIMARY KEY ("month")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ExitInterview_terminationId_key" ON "ExitInterview"("terminationId");`,
  `CREATE INDEX IF NOT EXISTS "ExitInterview_conductedAt_idx" ON "ExitInterview"("conductedAt");`,
];

// Escopo fechado: cria as tabelas ExitInterview (entrevista de desligamento) e TurnoverHeadcount (efetivo oficial por mês) e os índices, se ainda não existir. Idempotente. Nada mais.
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
