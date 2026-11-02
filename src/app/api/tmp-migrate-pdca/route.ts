import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "cbb795cdb09e1b73c63d717ade51095646357d3800779dd0cfef5042df735b8f";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "TurnoverPdca" (
    "year" INTEGER NOT NULL,
    "owner" TEXT,
    "monthlyGoal" DOUBLE PRECISION,
    "ytdGoal" DOUBLE PRECISION,
    "annualGoal" DOUBLE PRECISION,
    "causes" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "standardization" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TurnoverPdca_pkey" PRIMARY KEY ("year")
);`,
];

// Escopo fechado: cria a tabela TurnoverPdca (PDCA do turnover), se ainda não existir. Idempotente. Nada mais.
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
