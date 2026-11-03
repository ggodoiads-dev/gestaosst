import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "5da348abe90c1eb8bda9b02f52c00e713d085dad5ee4202fcdd9f1d9cc5ae874";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ExitSurveySummary" (
    "kind" TEXT NOT NULL,
    "periodLabel" TEXT,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExitSurveySummary_pkey" PRIMARY KEY ("kind")
);`,
];

// Escopo fechado: cria a tabela ExitSurveySummary (resumo das entrevistas de desligamento da plataforma externa), se ainda não existir. Idempotente. Nada mais.
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
