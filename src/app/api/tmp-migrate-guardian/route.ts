import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "e5c8daf33437978e52946d0cea79e8f064f42d5fef9a2692e54779acd0196d85";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "GuardianMonthSnapshot" (
    "month" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianMonthSnapshot_pkey" PRIMARY KEY ("month")
);`,
];

// Escopo fechado: cria a tabela GuardianMonthSnapshot (fechamento mensal da adesão do Guardian), se ainda não existir. Idempotente. Nada mais.
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
