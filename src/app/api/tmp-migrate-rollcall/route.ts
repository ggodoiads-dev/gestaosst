import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "19725fbcd18c4504c946ffec712b872a08fea1af78a935cb1155ef4fb222e36a";

// Migração fixa (mesmo SQL de prisma/migrations/20261008120000_add_user_roll_call_collaborator), idempotente.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "UserRollCallCollaborator" (
    "userId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    CONSTRAINT "UserRollCallCollaborator_pkey" PRIMARY KEY ("userId","collaboratorId")
  )`,
  `CREATE INDEX IF NOT EXISTS "UserRollCallCollaborator_collaboratorId_idx" ON "UserRollCallCollaborator"("collaboratorId")`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRollCallCollaborator_userId_fkey') THEN
      ALTER TABLE "UserRollCallCollaborator" ADD CONSTRAINT "UserRollCallCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRollCallCollaborator_collaboratorId_fkey') THEN
      ALTER TABLE "UserRollCallCollaborator" ADD CONSTRAINT "UserRollCallCollaborator_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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

  const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "UserRollCallCollaborator"`);
  return NextResponse.json({ ok: true, table: "UserRollCallCollaborator", rows: Number(rows[0].count) });
}
