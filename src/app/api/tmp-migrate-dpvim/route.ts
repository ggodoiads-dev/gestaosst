import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "78425e28a1bc582741af5bb4ee6231107111ccfb3da5c4a4a64585e0b24ef5cf";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Dpvim" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "reference" TEXT,
    "material" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "doneQty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dpvim_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Dpvim_code_key" ON "Dpvim"("code");`,
  `CREATE INDEX IF NOT EXISTS "Dpvim_status_idx" ON "Dpvim"("status");`,
  `CREATE INDEX IF NOT EXISTS "Dpvim_arrivedAt_idx" ON "Dpvim"("arrivedAt");`,
  `CREATE TABLE IF NOT EXISTS "DpvimSession" (
    "id" TEXT NOT NULL,
    "dpvimId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "workerName" TEXT NOT NULL,
    "partnerId" TEXT,
    "partnerName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startPhotoPath" TEXT NOT NULL,
    "startPhotoName" TEXT NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "qtyDone" INTEGER,
    "qtyGood" INTEGER,
    "qtyTransfer" INTEGER,
    "qtyDiscard" INTEGER,
    "notes" TEXT,
    CONSTRAINT "DpvimSession_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX IF NOT EXISTS "DpvimSession_dpvimId_idx" ON "DpvimSession"("dpvimId");`,
  `CREATE INDEX IF NOT EXISTS "DpvimSession_userId_stoppedAt_idx" ON "DpvimSession"("userId", "stoppedAt");`,
  `CREATE INDEX IF NOT EXISTS "DpvimSession_startedAt_idx" ON "DpvimSession"("startedAt");`,
];

// Escopo fechado: cria Dpvim e DpvimSession (ordens de servico da DPVIM e as sessoes de trabalho) com os indices, se ainda nao existirem. Idempotente. Nada mais.
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
