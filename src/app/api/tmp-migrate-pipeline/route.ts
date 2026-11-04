import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "2a0a126a9162ac1e9ad433faf53621563f152974f6106ea20b5184ceb8564aba";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "SuccessionPosition" (
    "id" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "area" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'MEDIA',
    "occupant" TEXT,
    "successor1" TEXT,
    "successor2" TEXT,
    "origin" TEXT,
    "readiness" TEXT,
    "potential" TEXT,
    "gap" TEXT,
    "action" TEXT,
    "dueDate" TIMESTAMP(3),
    "dueNote" TEXT,
    "status" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SuccessionPosition_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "SuccessionPosition_sortOrder_idx" ON "SuccessionPosition"("sortOrder");`,
  `CREATE TABLE IF NOT EXISTS "PeopleCycleEntry" (
    "id" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "collaboratorId" TEXT,
    "name" TEXT NOT NULL,
    "leader" TEXT,
    "cycleType" TEXT,
    "icc" DOUBLE PRECISION,
    "iccResult" TEXT,
    "ir" DOUBLE PRECISION,
    "irResult" TEXT,
    "selfEval" TEXT,
    "perfEval" TEXT,
    "finalClass" TEXT,
    "situation" TEXT,
    "follow" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PeopleCycleEntry_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "PeopleCycleEntry_cycleYear_idx" ON "PeopleCycleEntry"("cycleYear");`,
];

// Escopo fechado: cria as tabelas SuccessionPosition (plano de sucessão) e PeopleCycleEntry (ciclo de gente) e os índices, se ainda não existirem. Idempotente. Nada mais.
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
