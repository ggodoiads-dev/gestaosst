import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "c8efbfa78655f65965a5fd7e6e78e93f753f5e102682e06295c4c5149ffd75bc";

// Migração fixa (mesmo SQL de prisma/migrations/20261010100000_add_dto_action_suggestion), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DtoActionSuggestion" (
    "id" TEXT NOT NULL,
    "dtoEvaluationId" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,
    CONSTRAINT "DtoActionSuggestion_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DtoActionSuggestion_dtoEvaluationId_key" ON "DtoActionSuggestion"("dtoEvaluationId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DtoActionSuggestion_dtoEvaluationId_fkey') THEN
      ALTER TABLE "DtoActionSuggestion" ADD CONSTRAINT "DtoActionSuggestion_dtoEvaluationId_fkey" FOREIGN KEY ("dtoEvaluationId") REFERENCES "DtoEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "DtoActionSuggestion"`);
  return NextResponse.json({ ok: true, table: "DtoActionSuggestion", rows: Number(rows[0].count) });
}
