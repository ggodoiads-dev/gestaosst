import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "46ef4e8ae856d54f0316b2d39796b3f573e62bc8938ea803f6f369d7f0c701c9";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Termination" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "collaboratorId" TEXT,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "areaName" TEXT,
    "turnoName" TEXT,
    "admissionDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Termination_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Termination_dedupKey_key" ON "Termination"("dedupKey");`,
  `CREATE INDEX IF NOT EXISTS "Termination_terminationDate_idx" ON "Termination"("terminationDate");`,
  `CREATE INDEX IF NOT EXISTS "Termination_collaboratorId_idx" ON "Termination"("collaboratorId");`,
];

// Escopo fechado: cria a tabela Termination (desligamentos importados do RH) e seus índices, se ainda não existir. Idempotente. Nada mais.
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
