import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "dfe1d05bc69e5fda40f0930b8e7b490b33830a782b3e701fda9c4fc473649198";

// Migração fixa (mesmo SQL de prisma/migrations/20261009230000_add_dto_justification), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "DtoJustification" (
    "id" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DtoJustification_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "DtoJustification_collaboratorId_date_idx" ON "DtoJustification"("collaboratorId", "date")`,
  ...[
    ["collaboratorId", `"Collaborator"("id")`],
    ["createdById", `"User"("id")`],
  ].map(
    ([column, target]) => `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DtoJustification_${column}_fkey') THEN
      ALTER TABLE "DtoJustification" ADD CONSTRAINT "DtoJustification_${column}_fkey" FOREIGN KEY ("${column}") REFERENCES ${target} ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END $$`,
  ),
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  for (const statement of STATEMENTS) await db.$executeRawUnsafe(statement);

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "DtoJustification"`);
  return NextResponse.json({ ok: true, table: "DtoJustification", rows: Number(rows[0].count) });
}
