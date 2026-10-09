import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "ec412c2941244492c83b81abf96cba1b86b265159e8dc47774b7598b931d9674";

// Migração fixa (mesmo SQL de prisma/migrations/20261010150000_add_dto_action), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DtoAction" (
    "id" TEXT NOT NULL,
    "dtoEvaluationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "deadlineLabel" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DtoAction_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "DtoAction_dtoEvaluationId_idx" ON "DtoAction"("dtoEvaluationId")`,
  `CREATE INDEX IF NOT EXISTS "DtoAction_status_idx" ON "DtoAction"("status")`,
  `CREATE INDEX IF NOT EXISTS "DtoAction_dueDate_idx" ON "DtoAction"("dueDate")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DtoAction_dtoEvaluationId_fkey') THEN
      ALTER TABLE "DtoAction" ADD CONSTRAINT "DtoAction_dtoEvaluationId_fkey" FOREIGN KEY ("dtoEvaluationId") REFERENCES "DtoEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DtoAction_completedById_fkey') THEN
      ALTER TABLE "DtoAction" ADD CONSTRAINT "DtoAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "DtoAction"`);
  return NextResponse.json({ ok: true, table: "DtoAction", rows: Number(rows[0].count) });
}
