import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "beae5f5f2c0f898840ff1e8e3abd0a10da6784d2ac92b3c72ef8da9c472ad110";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DreImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "unit" TEXT,
    "officialAt" TEXT,
    "months" TEXT[],
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    CONSTRAINT "DreImport_pkey" PRIMARY KEY ("id")
);`,
  `CREATE TABLE IF NOT EXISTS "DreLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "remunerado" DOUBLE PRECISION NOT NULL,
    "realizado" DOUBLE PRECISION NOT NULL,
    "diferenca" DOUBLE PRECISION NOT NULL,
    "avr" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "DreLine_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DreLine_periodKey_code_key" ON "DreLine"("periodKey", "code");`,
  `CREATE INDEX IF NOT EXISTS "DreLine_periodKey_idx" ON "DreLine"("periodKey");`,
  `ALTER TABLE "DreImport" ADD CONSTRAINT "DreImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  `ALTER TABLE "DreLine" ADD CONSTRAINT "DreLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DreImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
];

// Escopo fechado: cria as tabelas do DRE (DreImport e DreLine), se ainda não existirem. Idempotente. Nada mais.
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
      await db.$executeRawUnsafe(sql);
      results.push("ok");
    } catch (error) {
      results.push(error instanceof Error && /already exists/i.test(error.message) ? "já existia" : "erro: " + String(error));
    }
  }
  return NextResponse.json({ ok: true, statements: results });
}
