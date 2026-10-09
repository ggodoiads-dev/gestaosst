import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "c8fedeb5c7934660c9402c98bd8941e9e2abaca561a3562aacb4fb5d376fdc3c";

// Migração fixa (mesmo SQL de prisma/migrations/20261009120000_add_checklist_item_justification), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ChecklistItemJustification" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reason" "ChecklistJustificationReason" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistItemJustification_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistItemJustification_collaboratorId_dayKey_itemId_key" ON "ChecklistItemJustification"("collaboratorId", "dayKey", "itemId")`,
  `CREATE INDEX IF NOT EXISTS "ChecklistItemJustification_dayKey_idx" ON "ChecklistItemJustification"("dayKey")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItemJustification_collaboratorId_fkey') THEN
      ALTER TABLE "ChecklistItemJustification" ADD CONSTRAINT "ChecklistItemJustification_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItemJustification_createdById_fkey') THEN
      ALTER TABLE "ChecklistItemJustification" ADD CONSTRAINT "ChecklistItemJustification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
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

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "ChecklistItemJustification"`);
  return NextResponse.json({ ok: true, table: "ChecklistItemJustification", rows: Number(rows[0].count) });
}
